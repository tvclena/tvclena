export const config = {
  runtime: "nodejs",
};

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { plano, email } = req.body;

  if (!process.env.MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "MP_ACCESS_TOKEN não configurado" });
  }

  // 🔎 Busca plano
  const { data: planoDB } = await sb
    .from("planos")
    .select("*")
    .eq("nome", plano)
    .eq("ativo", true)
    .single();

  if (!planoDB) {
    return res.status(400).json({ error: "Plano inválido" });
  }

  // 🔐 ID interno seguro
  const internalRef = crypto.randomUUID();

  // 💾 Salva pagamento PENDENTE
  await sb.from("pagamentos").insert({
    referencia: internalRef,
    status: "pending",
    valor: planoDB.valor,
    payer_email: email,
  });

  const preference = {
    items: [{
      title: planoDB.nome,
      quantity: 1,
      unit_price: Number(planoDB.valor),
      currency_id: "BRL",
    }],
    payer: { email },
    external_reference: internalRef,
    back_urls: {
      success: "https://clena.com.br/sucesso.html",
      failure: "https://clena.com.br/erro.html",
    },
    auto_return: "approved",
    notification_url: "https://clena.vercel.app/api/webhook-mercadopago",
  };

  const mpRes = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    }
  );

  const mpData = await mpRes.json();

  if (!mpRes.ok) {
    return res.status(500).json(mpData);
  }

  return res.json({
    url: mpData.init_point,
  });
}
