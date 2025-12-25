import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLANOS = {
  "Cinema": { valor: 1.99, dias: 30 },
  "Cinema Bet": { valor: 5.00, dias: 30 },
  "Studio": { valor: 15.00, dias: 30 }
};

export default async function handler(req, res) {
  try {
    const paymentId = req.query["data.id"];
    if (!paymentId) return res.status(200).end();

    // 🔎 Consulta pagamento no Mercado Pago
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
        }
      }
    );

    const payment = await mpRes.json();

    if (payment.status !== "approved") {
      return res.status(200).end();
    }

    // 🔁 Evita duplicidade
    const { data: existente } = await sb
      .from("pagamentos")
      .select("id")
      .eq("mp_payment_id", paymentId)
      .maybeSingle();

    if (existente) {
      return res.status(200).end();
    }

    const email = payment.external_reference || payment.payer?.email;
    const plano = payment.additional_info?.items?.[0]?.title;
    const valor = payment.transaction_amount;

    if (!email || !PLANOS[plano]) {
      return res.status(200).end();
    }

    // 🔐 Validação de valor
    if (PLANOS[plano].valor !== Number(valor)) {
      return res.status(200).end();
    }

    const { data: user } = await sb
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      return res.status(200).end();
    }

    // ⏱ Calcula vencimento
    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + PLANOS[plano].dias);

    // 🧾 Histórico
    await sb.from("pagamentos").insert({
      user_id: user.id,
      plano,
      mp_payment_id: paymentId,
      status: "approved",
      valor,
      metodo: payment.payment_method_id
    });

    // 👤 Atualiza usuário
    await sb.from("usuarios")
      .update({
        status: "aprovado",
        tipo_assinatura: plano,
        valor_assinatura: valor,
        vencimento_assinatura: vencimento.toISOString()
      })
      .eq("id", user.id);

    return res.status(200).end();

  } catch (e) {
    // ❗ webhook NUNCA pode retornar erro
    console.error("Webhook erro:", e);
    return res.status(200).end();
  }
}
