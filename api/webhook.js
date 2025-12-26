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

    // 🔎 Consulta pagamento REAL
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!mpRes.ok) {
      console.log("⚠️ Payment não encontrado (retry ou teste)");
      return res.status(200).json({ ignored: true });
    }

    const payment = await mpRes.json();

    const {
      status,
      status_detail,
      transaction_amount,
      payment_method_id,
      external_reference,
      date_approved,
    } = payment;

    if (!external_reference) {
      console.error("❌ Pagamento sem external_reference");
      return res.status(200).json({ error: true });
    }

    // 🔐 Atualiza pagamento PELO external_reference
    const { data: pagamento, error: errPagamento } = await sb
      .from("pagamentos")
      .update({
        payment_id: paymentId,
        status,
        status_detail,
        metodo: payment_method_id,
        valor: transaction_amount,
        aprovado_em: date_approved,
        updated_at: new Date(),
      })
      .eq("referencia", external_reference)
      .select("*")
      .maybeSingle();

    if (errPagamento || !pagamento) {
      console.error("❌ Pagamento não encontrado no banco");
      return res.status(200).json({ error: true });
    }

    // 🔁 Idempotência: se já processado, ignora
    if (pagamento.processado) {
      return res.status(200).json({ ok: true });
    }

    // 🔎 Busca usuário
    const { data: user } = await sb
      .from("usuarios")
      .select("*")
      .eq("id", pagamento.user_id)
      .maybeSingle();

    if (!user) {
      console.error("❌ Usuário não encontrado");
      return res.status(200).json({ error: true });
    }

    // 🔎 Busca plano
    const { data: plano } = await sb
      .from("planos")
      .select("*")
      .eq("id", pagamento.plano_id)
      .maybeSingle();

    if (!plano) {
      console.error("❌ Plano não encontrado");
      return res.status(200).json({ error: true });
    }

    // 🔓 APROVADO
    if (status === "approved") {
      const vencimento = new Date();
      vencimento.setDate(vencimento.getDate() + Number(plano.dias));

      await sb.from("usuarios")
        .update({
          status: "aprovado",
          tipo_assinatura: plano.nome,
          valor_assinatura: transaction_amount,
          vencimento_assinatura: vencimento.toISOString(),
        })
        .eq("id", user.id);
    }

    // 🔒 ESTORNO / CANCELAMENTO
    if (status === "refunded" || status === "cancelled") {
      await sb.from("usuarios")
        .update({
          status: "bloqueado",
          tipo_assinatura: null,
          valor_assinatura: null,
          vencimento_assinatura: null,
        })
        .eq("id", user.id);
    }

    // ✅ Marca como processado (idempotência)
    await sb.from("pagamentos")
      .update({ processado: true })
      .eq("id", pagamento.id);

    console.log("✅ Webhook processado:", status);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("🔥 ERRO WEBHOOK:", err);
    return res.status(200).json({ recovered: true });
  }
}
