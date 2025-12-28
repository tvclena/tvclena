export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
export default async function handler(req, res) {
  try {
    // Mercado Pago SEMPRE espera 200
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }
    const paymentId = req.body?.data?.id;
    if (!paymentId) {
      return res.status(200).json({ ignored: true });
    }
    // 🔎 Consulta pagamento no Mercado Pago
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!mpRes.ok) {
      return res.status(200).json({ ignored: true });
    }

    const payment = await mpRes.json();

    // 🔄 Atualiza status do pagamento
    await sb
      .from("pagamentos")
      .update({
        payment_id: payment.id,
        status: payment.status,
        valor: payment.transaction_amount,
        updated_at: new Date(),
      })
      .eq("referencia", payment.external_reference);

    // ❌ Só processa se aprovado
    if (payment.status !== "approved") {
      return res.status(200).json({ status: payment.status });
    }
    // 🔎 Busca pagamento + plano
    const { data: pag, error } = await sb
      .from("pagamentos")
      .select(`
        user_id,
        valor,
        processado,
        planos ( nome, dias )
      `)
      .eq("referencia", payment.external_reference)
      .single();

    if (error || !pag) {
      return res.status(200).json({ ignored: true });
    }
    //🔒 IDempotência (bloqueia duplicado)
    if (pag.processado === true) {
      return res.status(200).json({ duplicated: true });
    }
    // ===================
    // 🔐 ASSINATURA
    // ===================
    if (pag.planos.dias > 0) {
      const vencimento = new Date(
        Date.now() + pag.planos.dias * 86400000
      );

      await sb
        .from("usuarios")
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

      await sb.rpc("somar_saldo_carteira", {
        p_user_id: pag.user_id,
        p_valor: pag.valor,
      });
    }

    // ✅ Marca como processado
    await sb
      .from("pagamentos")
      .update({ processado: true })
      .eq("referencia", payment.external_reference);

    // =====================
    // 📊 GOOGLE ANALYTICS 4
    // =====================
    const gaRes = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: crypto.randomUUID(),
          user_id: String(pag.user_id),
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
                    quantity: 1,
                  },
                ],
              },
            },
          ],
        }),
      }
    );

    if (!gaRes.ok) {
      console.error("❌ GA4 erro:", await gaRes.text());
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ Webhook erro:", err);
    // SEMPRE 200 para MP não reenviar em loop
    return res.status(200).json({ recovered: true });
  }
}
