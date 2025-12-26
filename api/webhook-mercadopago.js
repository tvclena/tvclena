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
    // Mercado Pago exige resposta rápida
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    const { type, data } = req.body;

    console.log("📩 Webhook recebido:", req.body);

    // Só processamos pagamento
    if (type !== "payment") {
      return res.status(200).json({ ignored: true });
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return res.status(400).json({ error: "payment_id ausente" });
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

    console.log("💳 Pagamento consultado:", payment.status);

    const {
      status,
      status_detail,
      transaction_amount,
      payer,
      date_approved,
      payment_method_id,
      external_reference,
    } = payment;

    // 🔐 Atualiza no Supabase
    const { error } = await sb.from("pagamentos").update({
      status,
      status_detail,
      valor: transaction_amount,
      metodo: payment_method_id,
      aprovado_em: date_approved,
      payer_email: payer?.email,
      updated_at: new Date(),
    })
    .eq("payment_id", paymentId);

    if (error) {
      console.error("❌ Erro Supabase:", error);
      return res.status(500).json({ error: "Erro ao salvar pagamento" });
    }

    console.log("✅ Pagamento atualizado:", paymentId);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("🔥 Erro webhook:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
