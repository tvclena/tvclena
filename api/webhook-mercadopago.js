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
function ok(res, payload = {}) {
  return res.status(200).json({ ok: true, ...payload });
}

function now() {
  return new Date();
}

function diasParaMs(dias) {
  return dias * 86400000;
}

/* =====================================================
   🚀 WEBHOOK HANDLER
===================================================== */
export default async function handler(req, res) {
  try {
    // Mercado Pago SEMPRE exige 200
    if (req.method !== "POST") {
      return ok(res);
    }

    // Aceita apenas eventos de pagamento
    if (req.body?.type !== "payment") {
      return ok(res, { ignored: true });
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
      console.error("❌ Erro ao consultar Mercado Pago");
      return ok(res);
    }

    const payment = await mpRes.json();

    if (!payment.external_reference) {
      return ok(res, { ignored: true });
    }

    const referencia = payment.external_reference;

    /* =====================================================
       🔄 ATUALIZA DADOS DO PAGAMENTO
    ===================================================== */
    await sb
      .from("pagamentos")
      .update({
        mp_payment_id: String(payment.id),
        status: payment.status,
        status_detail: payment.status_detail || null,
        metodo: payment.payment_method_id || "mercadopago",
        valor: payment.transaction_amount,
        mp_raw: payment,
        updated_at: now(),
      })
      .eq("referencia", referencia);

    // Só processa se aprovado
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
      return ok(res);
    }

    /* =====================================================
       🔒 IDEMPOTÊNCIA (ANTI DUPLICAÇÃO)
    ===================================================== */
    if (pag.processado === true) {
      return ok(res, { duplicated: true });
    }

    /* =====================================================
       🧩 PROCESSAMENTO DO PAGAMENTO
    ===================================================== */

    // =====================
    // 📦 ASSINATURA
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
      await sb.rpc("somar_saldo_carteira", {
        p_user_id: pag.user_id,
        p_valor: pag.valor,
      });
    }

    /* =====================================================
       ✅ FINALIZA PAGAMENTO
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
  const isAssinatura = pag.planos?.dias > 0;

  const gaPayload = {
    client_id: crypto
      .createHash("sha256")
      .update(String(pag.user_id))
      .digest("hex"),

    user_id: String(pag.user_id),

    events: [
      {
        name: "purchase",
        params: {
          transaction_id: referencia,
          value: pag.valor,
          currency: "BRL",

          // 🔖 diferencia APEX x ASSINATURA
          tipo_produto: isAssinatura ? "assinatura" : "apex",
          plano: isAssinatura ? pag.planos?.nome : null,

          engagement_time_msec: 100,

          items: [
            {
              item_name: isAssinatura ? pag.planos?.nome : "Apex",
              item_category: isAssinatura ? "Assinatura" : "Recarga",
              price: pag.valor,
              quantity: 1,
            },
          ],
        },
      },
    ],
  };

  const gaRes = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gaPayload),
    }
  );

  if (!gaRes.ok) {
    console.error(
      "❌ GA4 rejeitou evento:",
      gaRes.status,
      await gaRes.text()
    );
  }
} catch (gaErr) {
  console.error("⚠️ Erro GA4:", gaErr);
}

return ok(res, { success: true });

} catch (err) {
console.error("❌ WEBHOOK ERRO CRÍTICO:", err);
return ok(res, { recovered: true });
}
}

