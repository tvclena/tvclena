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
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método inválido" });
    }

    const { email, plano } = req.body;

    if (!email || !plano) {
      return res.status(400).json({ error: "Dados ausentes" });
    }

    // 🔎 usuário
    const { data: user } = await sb
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    // 🔎 plano
    const { data: planoDB } = await sb
      .from("planos")
      .select("*")
      .eq("nome", plano)
      .eq("ativo", true)
      .single();

    if (!planoDB) {
      return res.status(404).json({ error: "Plano inválido" });
    }

    const referencia = crypto.randomUUID();

    // 💾 salva pagamento PENDENTE
    await sb.from("pagamentos").insert({
      referencia,
      user_id: user.id,
      plano_id: planoDB.id,
      tipo: "assinatura",
      valor: planoDB.valor,
      status: "pending",
      processado: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // 💳 cria preference MP
    const mpRes = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              title: planoDB.nome,
              quantity: 1,
              unit_price: Number(planoDB.valor),
              currency_id: "BRL",
            },
          ],
          payer: { email },
          external_reference: referencia,
          auto_return: "approved",
          back_urls: {
            success: "https://www.clena.com.br/sucesso.html",
            failure: "https://www.clena.com.br/erro.html",
          },
          notification_url:
            "https://www.clena.com.br/api/webhook-mercadopago",
        }),
      }
    );

    const mpData = await mpRes.json();

    if (!mpRes.ok || !mpData.init_point) {
      return res.status(500).json({ error: "Erro Mercado Pago", mpData });
    }

    return res.status(200).json({ url: mpData.init_point });

  } catch (err) {
    console.error("❌ create-payment erro:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
