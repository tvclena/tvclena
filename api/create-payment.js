import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { plano, valor, email } = req.body;

  const preference = {
    items: [{
      title: plano,
      quantity: 1,
      unit_price: Number(valor)
    }],
    payer: { email },
    back_urls: {
      success: "https://clena.com.br/index.html",
      failure: "https://clena.com.br/planos.html"
    },
    auto_return: "approved",
    notification_url: "https://SEUDOMINIO.com/api/webhook"
  };

  const mpRes = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    }
  );

  const data = await mpRes.json();
  res.json({ url: data.init_point });
}
