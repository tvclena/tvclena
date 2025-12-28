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
    // =====================================
    // 🔹 LISTAR PLANOS APEX (SEM PAGAMENTO)
    // =====================================
    if (
      req.method === "POST" &&
      req.body?.action === "list_apex"
    ) {
      const { data, error } = await sb
        .from("planos")
        .select("nome, valor")
        .eq("ativo", true)
        .eq("dias", 0)
        .order("valor", { ascending: true });

      if (error) {
        console.error("Erro listar Apex:", error);
        return res.status(500).json([]);
      }

      return res.status(200).json(data || []);
    }

    // =====================================
    // 🔻 DAQUI PRA BAIXO: PAGAMENTO NORMAL
    // =====================================
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

const { data: planoDB, error: planoError } = await sb
  .from("planos")
  .select("*")
  .eq("nome", plano)
  .eq("ativo", true)
  .eq("dias", 0) // ✅ APEX
  .single();

if (planoError || !planoDB) {
  return res.status(400).json({ error: "Plano Apex inválido" });
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

    const referencia = crypto.randomUUID();

    const { error: insertError } = await sb
      .from("pagamentos")
      .insert({
        referencia,
        user_id: user.id,
        plano_id: planoDB.id,
        status: "pending",
        valor: planoDB.valor,
        processado: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

    if (insertError) {
      console.error("❌ ERRO INSERT PAGAMENTOS:", insertError);
      return res.status(500).json({
        error: "Erro ao registrar pagamento",
        detail: insertError.message,
      });
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
