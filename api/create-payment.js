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

    const { plano, email } = req.body;

    if (!email || !plano) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({ error: "MP_ACCESS_TOKEN ausente" });
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

    // 🔎 Busca usuário
    const { data: user } = await sb
      .from("usuarios")
      .select("id, email")
      .eq("email", email)
      .single();

    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    // 🔐 Referência interna
    const referencia = crypto.randomUUID();

    // 💾 INSERT PENDENTE (OBRIGATÓRIO)
    const { error: insertError } = await sb.from("pagamentos").insert({
      referencia,
      user_id: user.id,
      plano_id: planoDB.id,
      status: "pending",
      valor: planoDB.valor,
    });

    if (insertError) {
      console.error("Erro insert pagamentos:", insertError);
      return res.status(500).json({ error: "Erro ao registrar pagamento" });
    }

    // 💳 Preference Mercado Pago
    const preference = {
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
      back_urls: {
        success: "https://www.clena.com.br/sucesso.html",
        failure: "https://www.clena.com.br/erro.html",
      },
      auto_return: "approved",
      notification_url: "https://www.clena.com.br/api/webhook-mercadopago",
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
      console.error("Erro MP:", mpData);
      return res.status(500).json(mpData);
    }

    return res.json({
      url: mpData.init_point,
    });

  } catch (err) {
    console.error("Erro create-payment:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
