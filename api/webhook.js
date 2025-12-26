export const config = {
  runtime: "nodejs"
};

import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // 🔒 Webhook SEMPRE responde 200
    if (req.method !== "POST") {
      return res.status(200).end();
    }

    const { type, data } = req.body || {};

    // 🎯 Processa apenas eventos de pagamento
    if (type !== "payment") {
      return res.status(200).end();
    }

    const paymentId = data?.id;
    if (!paymentId) {
      return res.status(200).end();
    }

    // 🔎 Busca pagamento no Mercado Pago
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
        }
      }
    );

    const payment = await mpRes.json();

    // ⛔ Só continua se estiver aprovado
    if (payment.status !== "approved") {
      return res.status(200).end();
    }

    // 🔁 Evita pagamento duplicado
    const { data: existente } = await sb
      .from("pagamentos")
      .select("id")
      .eq("mp_payment_id", paymentId)
      .maybeSingle();

    if (existente) {
      return res.status(200).end();
    }

    // 📩 Dados essenciais
    const email = payment.external_reference || payment.payer?.email;
    const planoNome =
      payment.additional_info?.items?.[0]?.title ||
      payment.description;

    const valorPago = Number(payment.transaction_amount);

    if (!email || !planoNome || !valorPago) {
      return res.status(200).end();
    }

    // 🔎 Busca plano válido
    const { data: plano } = await sb
      .from("planos")
      .select("*")
      .eq("nome", planoNome)
      .eq("ativo", true)
      .single();

    if (!plano) {
      return res.status(200).end();
    }

    // 🔐 Valida valor
    if (Number(plano.valor) !== valorPago) {
      return res.status(200).end();
    }

    // 👤 Busca usuário
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
    vencimento.setDate(vencimento.getDate() + Number(plano.dias));

    // 🧾 Registra pagamento
    await sb.from("pagamentos").insert({
      user_id: user.id,
      plano: plano.nome,
      mp_payment_id: paymentId,
      status: "approved",
      valor: valorPago,
      metodo: payment.payment_method_id
    });

    // 👤 Atualiza assinatura do usuário
    await sb
      .from("usuarios")
      .update({
        status: "aprovado",
        tipo_assinatura: plano.nome,
        valor_assinatura: valorPago,
        vencimento_assinatura: vencimento.toISOString()
      })
      .eq("id", user.id);

    return res.status(200).end();

  } catch (err) {
    // ❗ Webhook NUNCA deve falhar
    console.error("Webhook erro:", err);
    return res.status(200).end();
  }
}
