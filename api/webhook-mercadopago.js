export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }

    const paymentId = req.body?.data?.id;
    if (!paymentId) {
      return res.status(200).json({ ignored: true });
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    const payment = await mpRes.json();
    if (!mpRes.ok) {
      return res.status(200).json({ ignored: true });
    }

    await sb.from("pagamentos")
      .update({
        payment_id: payment.id,
        status: payment.status,
        valor: payment.transaction_amount,
        updated_at: new Date(),
      })
      .eq("referencia", payment.external_reference);

    if (payment.status === "approved") {
  const { data: pag } = await sb
    .from("pagamentos")
    .select(`
      user_id,
      valor,
      planos ( nome, dias )
    `)
    .eq("referencia", payment.external_reference)
    .single();

// 🔀 DECISÃO POR TIPO DE PLANO
if (pag.planos.dias > 0) {

  // =====================
  // 🔐 ASSINATURA
  // =====================
  const vencimento = new Date(
    Date.now() + pag.planos.dias * 86400000
  );

  await sb.from("usuarios")
    .update({
      status: "aprovado",
      valor_assinatura: pag.valor,
      tipo_assinatura: pag.planos.nome,
      vencimento_assinatura: vencimento,
    })
    .eq("id", pag.user_id);

} else {

  // =====================
  // 💰 RECARGA APEX
  // =====================

  // 🔒 evita crédito duplicado
  if (pag.processado === true) return;

  // ➕ soma saldo na carteira
  await sb.rpc("somar_saldo_carteira", {
    p_user_id: pag.user_id,
    p_valor: pag.valor
  });

  // ✅ marca pagamento como processado
  await sb.from("pagamentos")
    .update({ processado: true })
    .eq("referencia", payment.external_reference);
}


  // 🔽🔽🔽 AQUI É O LUGAR CERTO 🔽🔽🔽
  // 📊 ENVIA COMPRA PARA GA4 (SERVER-SIDE)
  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: String(pag.user_id),
        events: [
          {
            name: "purchase",
            params: {
              transaction_id: payment.external_reference,
              value: pag.valor,
              currency: "BRL",
              items: [
                {
                  item_name: pag.planos.nome,
                  price: pag.valor,
                  quantity: 1
                }
              ]
            }
          }
        ]
      })
    }
  );
}


    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook erro:", err);
    return res.status(200).json({ recovered: true });
  }
}
