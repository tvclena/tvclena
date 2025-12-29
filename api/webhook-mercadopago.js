export const config = {
  runtime: "nodejs",
};

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/* =====================================================
   🔐 SUPABASE (SERVICE ROLE)
===================================================== */
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* =====================================================
   🧠 HELPERS
===================================================== */

// Sempre retornar 200 (Mercado Pago exige)
function ok(res, payload = {}) {
  return res.status(200).json({ ok: true, ...payload });
}

// Datas
function now() {
  return new Date();
}

// Dias → ms
function diasParaMs(dias) {
  return dias * 86400000;
}

/* =====================================================
   🚀 WEBHOOK HANDLER
===================================================== */
export default async function handler(req, res) {
  try {
    // 🔥 MP SEMPRE espera 200
    if (req.method !== "POST") {
      return ok(res);
    }

    const paymentId = req.body?.data?.id;
    if (!paymentId) {
      return ok(res, { ignored: true });
    }

    /* =====================================================
       🔎 CONSULTA PAGAMENTO NO MERCADO PAGO
    ===================================================== */
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        },
      }
    );

    if (!mpRes.ok) {
      console.error("❌ MP fetch erro");
      return ok(res, { ignored: true });
    }

    const payment = await mpRes.json();

    // 🔐 valida referência
    if (!payment.external_reference) {
      return ok(res, { ignored: true });
    }

    const referencia = payment.external_reference;

    /* =====================================================
       🔄 ATUALIZA STATUS (sempre sincroniza)
    ===================================================== */
    await sb
      .from("pagamentos")
      .update({
        payment_id: payment.id,
        status: payment.status,
        valor: payment.transaction_amount,
        updated_at: now(),
      })
      .eq("referencia", referencia);

    // ❌ só continua se aprovado
    if (payment.status !== "approved") {
      return ok(res, { status: payment.status });
    }

    /* =====================================================
       🔎 BUSCA PAGAMENTO INTERNO + PLANO
    ===================================================== */
    const { data: pag, error } = await sb
      .from("pagamentos")
      .select(`
        id,
        user_id,
        valor,
        processado,
        tipo,
        planos ( nome, dias )
      `)
      .eq("referencia", referencia)
      .single();

    if (error || !pag) {
      console.error("❌ Pagamento interno não encontrado");
      return ok(res, { ignored: true });
    }

    // 🔒 IDEMPOTÊNCIA (anti crédito duplo)
    if (pag.processado === true) {
      return ok(res, { duplicated: true });
    }

    /* =====================================================
       🧩 PROCESSAMENTO
    ===================================================== */

    // =====================
    // 🔐 ASSINATURA
    // =====================
    if (pag.planos?.dias > 0) {
      const vencimento = new Date(
        Date.now() + diasParaMs(pag.planos.dias)
      );

      await sb
        .from("usuarios")
        .update({
          status: "ativo",
          tipo_assinatura: pag.planos.nome,
          valor_assinatura: pag.valor,
          vencimento_assinatura: vencimento,
        })
        .eq("id", pag.user_id);
    }

    // =====================
    // 💰 RECARGA APEX
    // =====================
    else {
      // saldo SEMPRE em REAIS (conversão é só visual)
      await sb.rpc("somar_saldo_carteira", {
        p_user_id: pag.user_id,
        p_valor: pag.valor,
      });
    }

    /* =====================================================
       ✅ MARCA COMO PROCESSADO (FINAL)
    ===================================================== */
    await sb
      .from("pagamentos")
      .update({
        processado: true,
        updated_at: now(),
      })
      .eq("id", pag.id);

    /* =====================================================
       📊 GOOGLE ANALYTICS 4 (SERVER SIDE)
    ===================================================== */
    try {
      await fetch(
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
                  transaction_id: referencia,
                  value: pag.valor,
                  currency: "BRL",
                  items: [
                    {
                      item_name: pag.planos?.nome || "Apex",
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
    } catch (gaErr) {
      console.error("⚠️ GA4 erro:", gaErr);
    }

    /* =====================================================
       🟢 FINAL OK
    ===================================================== */
    return ok(res, { success: true });

  } catch (err) {
    console.error("❌ WEBHOOK ERRO CRÍTICO:", err);

    // ⚠️ SEMPRE 200 (MP não pode reenviar em loop)
    return ok(res, { recovered: true });
  }
}
