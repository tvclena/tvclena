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

      const vencimento = pag?.planos?.dias
        ? new Date(Date.now() + pag.planos.dias * 86400000)
        : null;

      await sb.from("usuarios")
        .update({
          status: "aprovado",
          valor_assinatura: pag.valor,
          tipo_assinatura: pag.planos.nome,
          vencimento_assinatura: vencimento,
        })
        .eq("id", pag.user_id);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Webhook erro:", err);
    return res.status(200).json({ recovered: true });
  }
}
