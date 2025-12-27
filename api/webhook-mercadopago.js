export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    console.log("📩 Webhook recebido:", JSON.stringify(req.body));

    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }

    const paymentId = req.body?.data?.id;
    if (!paymentId) {
      return res.status(200).json({ ignored: true });
    }

    // 🔎 Consulta pagamento real no Mercado Pago
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
      console.log("⚠️ Payment não encontrado");
      return res.status(200).json({ ignored: true });
    }

    console.log("💳 Pagamento:", {
      id: payment.id,
      status: payment.status,
      reference: payment.external_reference,
    });

    // ✅ Atualiza Supabase
    const { error } = await sb
      .from("pagamentos")
      .update({
        payment_id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        aprovado_em: payment.date_approved,
        metodo: payment.payment_method_id,
        updated_at: new Date(),
      })
      .eq("referencia", payment.external_reference);

    if (error) {
      console.error("❌ Erro Supabase:", error);
    }

    // 🎯 DISPARA GA4 SOMENTE SE APROVADO
    if (payment.status === "approved") {
      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: `payment_${payment.id}`,
            events: [
              {
                name: "purchase",
                params: {
                  transaction_id: payment.id,
                  value: payment.transaction_amount,
                  currency: payment.currency_id || "BRL",
                  payment_type: payment.payment_method_id,
                  items: [
                    {
                      item_name: "Plano CLENA TV",
                      price: payment.transaction_amount,
                      quantity: 1,
                    },
                  ],
                },
              },
            ],
          }),
        }
      );

      console.log("📊 GA4 purchase enviado");
    }

    console.log("✅ Webhook finalizado");
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("🔥 ERRO WEBHOOK:", err);
    return res.status(200).json({ recovered: true });
  }
}
