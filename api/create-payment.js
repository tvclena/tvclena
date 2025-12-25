import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { plano, valor, email } = req.body;

  const PLANOS = {
    "Cinema": 1.99,
    "Cinema Bet": 5.00,
    "Studio": 15.00
  };

  if (PLANOS[plano] !== Number(valor)) {
    return res.status(400).json({ error: "Plano inválido" });
  }

  const preference = {
    items: [{
      title: plano,
      quantity: 1,
      unit_price: Number(valor),
      currency_id: "BRL"
    }],
    payer: { email },
    external_reference: email,
    back_urls: {
      success: "https://clena.com.br/index.html",
      failure: "https://clena.com.br/planos.html"
    },
    auto_return: "approved",
    notification_url: "https://clena.com.br/api/webhook"
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

  if (!mpRes.ok) {
    const erro = await mpRes.text();
    return res.status(500).json({ error: erro });
  }

  const data = await mpRes.json();
  res.json({ url: data.init_point });
}
