import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const paymentId = req.query["data.id"];
  if (!paymentId) return res.status(200).end();

  const mp = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`
      }
    }
  );

  const payment = await mp.json();
  if (payment.status !== "approved") return res.status(200).end();

  const email = payment.payer.email;
  const plano = payment.additional_info?.items?.[0]?.title;
  const valor = payment.transaction_amount;

  const { data: user } = await sb
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .single();

  if (!user) return res.status(200).end();

  const dias = 30;
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + dias);

  await sb.from("pagamentos").insert({
    user_id: user.id,
    plano,
    mp_payment_id: paymentId,
    status: "approved",
    valor,
    metodo: payment.payment_method_id
  });

  await sb.from("usuarios")
    .update({
      status: "aprovado",
      tipo_assinatura: plano,
      valor_assinatura: valor,
      vencimento_assinatura: vencimento.toISOString()
    })
    .eq("id", user.id);

  res.status(200).end();
}
