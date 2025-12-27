export default async function handler(req, res) {
  try {
    const r = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: "teste_backend_ok",
          events: [
            {
              name: "purchase",
              params: {
                transaction_id: "TESTE_BACKEND_001",
                value: 49.9,
                currency: "BRL",
                items: [
                  {
                    item_name: "Plano Backend",
                    price: 49.9,
                    quantity: 1
                  }
                ]
              }
            }
          ]
        })
      }
    );

    return res.status(200).json({
      ok: true,
      status: r.status
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
