export const config = {
  runtime: "nodejs"
};

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { plano, email } = req.body;
  // agora "plano" é o NOME ou ID (vamos alinhar depois no front)

  if (!process.env.MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "MP_ACCESS_TOKEN não configurado" });
  }

  /* 🔎 BUSCA O PLANO NO SUPABASE */
  const { data: planoDB, error } = await sb
    .from("planos")
    .select("*")
    .eq("nome", plano)
    .eq("ativo", true)
    .single();

  if (error || !planoDB) {
    return res.status(400).json({ error: "Plano inválido ou inativo" });
  }

  const preference = {
    items: [{
      title: planoDB.nome,
      quantity: 1,
      unit_price: Number(planoDB.valor),
      currency_id: "BRL"
    }],
    payer: { email },
    external_reference: email,
    back_urls: {
      success: "https://clena.com.br/index.html",
      failure: "https://clena.com.br/planos.html"
    },
    auto_return: "approved",
notification_url: "https://clena.vercel.app/api/webhook"
  };

  const mpRes = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    }
  );

  const data = await mpRes.json();

  if (!mpRes.ok) {
    console.error("Mercado Pago erro:", data);
    return res.status(500).json(data);
  }

  return res.json({ url: data.init_point });
}
