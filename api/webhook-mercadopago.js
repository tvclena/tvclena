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
      console.log("⚠️ Webhook sem payment id");
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

    const payment = await mpRes.json();

    if (!mpRes.ok) {
      console.log("⚠️ Pagamento não encontrado no MP");
      return res.status(200).json({ ignored: true });
    }

    console.log("💳 Pagamento MP:", {
      id: payment.id,
      status: payment.status,
      reference: payment.external_reference,
      value: payment.transaction_amount,
    });

    // 🔄 Atualiza PAGAMENTOS
    await sb.from("pagamentos")
      .update({
        payment_id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        metodo: payment.payment_method_id,
        valor: payment.transaction_amount,
        updated_at: new Date(),
      })
      .eq("referencia", payment.external_reference);

    // ======================================================
    // ✅ SE APROVADO → LIBERA USUÁRIO
    // ======================================================
    if (payment.status === "approved") {

      // 🔎 Busca pagamento + plano
      const { data: pagamentoDB, error } = await sb
        .from("pagamentos")
        .select(`
          user_id,
          valor,
          planos (
            nome,
            dias
          )
        `)
        .eq("referencia", payment.external_reference)
        .single();

      if (error || !pagamentoDB) {
        console.error("❌ Pagamento não encontrado no Supabase");
        return res.status(200).json({ recovered: true });
      }

      // 📅 Calcula vencimento pelo plano
      let vencimento = null;
      if (pagamentoDB.planos?.dias) {
        vencimento = new Date(
          Date.now() + pagamentoDB.planos.dias * 24 * 60 * 60 * 1000
        );
      }

      // 🔓 Atualiza USUÁRIO
      const { error: userErr } = await sb
        .from("usuarios")
        .update({
          status: "aprovado",
          valor_assinatura: pagamentoDB.valor,
          tipo_assinatura: pagamentoDB.planos.nome,
          vencimento_assinatura: vencimento,
          updated_at: new Date(),
        })
        .eq("id", pagamentoDB.user_id);

      if (userErr) {
        console.error("❌ Erro ao atualizar usuário:", userErr);
      } else {
        console.log("✅ Usuário liberado com sucesso");
      }
    }

    console.log("✅ Webhook finalizado");
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("🔥 ERRO WEBHOOK:", err);
    return res.status(200).json({ recovered: true });
  }
}
