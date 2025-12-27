export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    console.log("📩 Webhook recebido:", JSON.stringify(req.body));

    // Mercado Pago envia vários métodos — só POST importa
    if (req.method !== "POST") {
      return res.status(200).json({ ok: true });
    }

    const paymentId = req.body?.data?.id;
    if (!paymentId) {
      console.log("⚠️ Webhook sem payment id");
      return res.status(200).json({ ignored: true });
    }

    // 🔎 Consulta pagamento REAL no Mercado Pago
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

    // 🔄 Atualiza tabela PAGAMENTOS
    const { error: pagUpdateErr } = await sb
      .from("pagamentos")
      .update({
        payment_id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        aprovado_em: payment.date_approved,
        metodo: payment.payment_method_id,
        valor: payment.transaction_amount,
        updated_at: new Date(),
      })
      .eq("referencia", payment.external_reference);

    if (pagUpdateErr) {
      console.error("❌ Erro ao atualizar pagamentos:", pagUpdateErr);
    }

    // ======================================================
    // ✅ SE PAGAMENTO APROVADO → LIBERA USUÁRIO
    // ======================================================
    if (payment.status === "approved") {

      // 🔎 Busca o pagamento salvo no banco
      const { data: pagamentoDB, error: pagErr } = await sb
        .from("pagamentos")
        .select("*")
        .eq("referencia", payment.external_reference)
        .single();

      if (pagErr || !pagamentoDB) {
        console.error("❌ Pagamento não encontrado no Supabase");
      } else {

        // 📅 Calcula vencimento (mensal / vitalícia)
        let vencimento = null;

        if (pagamentoDB.tipo_assinatura === "Mensal") {
          vencimento = new Date(
            new Date().setMonth(new Date().getMonth() + 1)
          );
        }

        // 🔓 Atualiza USUÁRIO
        const { error: userErr } = await sb
          .from("usuarios")
          .update({
            status: "aprovado",          // ou "ativo"
            bloqueado: false,
            valor_assinatura: pagamentoDB.valor,
            tipo_assinatura: pagamentoDB.tipo_assinatura,
            vencimento_assinatura: vencimento,
            updated_at: new Date(),
          })
          .eq("id", pagamentoDB.usuario_id);

        if (userErr) {
          console.error("❌ Erro ao atualizar usuário:", userErr);
        } else {
          console.log("✅ Usuário liberado com sucesso");
        }
      }

      // ======================================================
      // 📊 GA4 — PURCHASE
      // ======================================================
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
                      item_name: pagamentoDB?.tipo_assinatura || "Plano CLENA TV",
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
