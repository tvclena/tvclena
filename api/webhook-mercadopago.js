export const config = {
  runtime: "nodejs",
};

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    console.log("📩 Webhook recebido:", JSON.stringify(req.body));

    // Mercado Pago exige resposta 200 rápida
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }

    const body = req.body || {};

    // 🛡️ Suporte TOTAL ao payload de teste e real
    const paymentId =
      body?.data?.id ||
      body?.resource?.split("/")?.pop() ||
      null;

    if (!paymentId) {
      console.log("⚠️ Webhook sem paymentId (ignorado)");
      return res.status(200).json({ ignored: true });
    }

    // 🔎 Consulta pagamento real
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
      console.error("❌ Erro MP:", payment);
      return res.status(200).json({ error: "MP fetch failed" });
    }

    console.log("💳 Status pagamento:", payment.status);

    // 💾 Atualiza pagamento (não quebra se não existir)
    await sb
      .from("pagamentos")
      .update({
        payment_id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        valor: payment.transaction_amount,
        payer_email: payment.payer?.email,
        aprovado_em: payment.date_approved,
        updated_at: new Date(),
      })
      .eq("payment_id", payment.id);

    console.log("✅ Webhook processado com sucesso");

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("🔥 ERRO WEBHOOK:", err);
    // ⚠️ NUNCA devolver 500 para o Mercado Pago
    return res.status(200).json({ recovered: true });
  }
}
