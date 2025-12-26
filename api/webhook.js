export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(200).end();

    const { type, data } = req.body || {};
    if (type !== "payment") return res.status(200).end();

    const paymentId = data?.id;
    if (!paymentId) return res.status(200).end();

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
        }
      }
    );

    if (!mpRes.ok) return res.status(200).end();
    const payment = await mpRes.json();

    if (payment.status !== "approved") return res.status(200).end();

    const email = payment.external_reference;
    if (!email) return res.status(200).end();

    const planoNome =
      payment.additional_info?.items?.[0]?.title || payment.description;

    if (!planoNome) return res.status(200).end();

    const valorPago = Number(payment.transaction_amount);

    const { data: existente } = await sb
      .from("pagamentos")
      .select("id")
      .eq("mp_payment_id", paymentId)
      .maybeSingle();

    if (existente) return res.status(200).end();

    const { data: plano } = await sb
      .from("planos")
      .select("*")
      .ilike("nome", planoNome)
      .eq("ativo", true)
      .maybeSingle();

    if (!plano) return res.status(200).end();
    if (Number(plano.valor) !== valorPago) return res.status(200).end();

    const { data: user } = await sb
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!user) return res.status(200).end();

    const vencimento = new Date();
    vencimento.setDate(vencimento.getDate() + Number(plano.dias));

    await sb.from("pagamentos").insert({
      user_id: user.id,
      plano: plano.nome,
      mp_payment_id: paymentId,
      status: "approved",
      valor: valorPago,
      metodo: payment.payment_method_id
    });

    await sb.from("usuarios")
      .update({
        status: "aprovado",
        tipo_assinatura: plano.nome,
        valor_assinatura: valorPago,
        vencimento_assinatura: vencimento.toISOString()
      })
      .eq("id", user.id);

    return res.status(200).end();

  } catch (err) {
    console.error("Webhook erro:", err);
    return res.status(200).end();
  }
}
