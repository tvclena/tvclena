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

    // 🔎 Consulta pagamento REAL
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
      console.log("⚠️ Payment não encontrado (teste ou retry)");
      return res.status(200).json({ ignored: true });
    }

    console.log("💳 Pagamento real:", {
      id: payment.id,
      status: payment.status,
      reference: payment.external_reference,
    });

    // ✅ ATUALIZA PELO external_reference
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

    console.log("✅ Pagamento sincronizado no Supabase");

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("🔥 ERRO WEBHOOK:", err);
    return res.status(200).json({ recovered: true });
  }
}
