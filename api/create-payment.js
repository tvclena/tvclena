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
    // ==================================================
    // 🔹 LISTAR PLANOS APEX (SEM PAGAMENTO)
    // ==================================================
    if (req.method === "POST" && req.body?.action === "list_apex") {
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

    // ==================================================
    // 🔻 PAGAMENTOS (APEX OU ASSINATURA)
    // ==================================================
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método inválido" });
    }

    const { plano, email, action } = req.body;

    if (!email || !plano) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    if (!process.env.MP_ACCESS_TOKEN) {
      return res.status(500).json({ error: "MP_ACCESS_TOKEN ausente" });
    }

    // ==================================================
    // 🔀 IDENTIFICA O TIPO
    // ==================================================
    const isApex = action === "apex_payment";

    // ==================================================
    // 🔎 BUSCA PLANO CORRETO
    // ==================================================
    let planoQuery = sb
      .from("planos")
      .select("*")
      .eq("nome", plano)
      .eq("ativo", true);

    if (isApex) {
      planoQuery = planoQuery.eq("dias", 0);     // 🔥 APEX
    } else {
      planoQuery = planoQuery.gt("dias", 0);     // 🔒 ASSINATURA
    }

    const { data: planoDB, error: planoError } =
      await planoQuery.single();

    if (planoError || !planoDB) {
      return res.status(400).json({
        error: isApex
          ? "Plano Apex inválido"
          : "Plano de assinatura inválido",
      });
    }

    // ==================================================
    // 🔎 BUSCA USUÁRIO
    // ==================================================
    const { data: user, error: userError } = await sb
      .from("usuarios")
      .select("id, email")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    // ==================================================
    // 🧾 REGISTRA PAGAMENTO
    // ==================================================
    const referencia = crypto.randomUUID();

    const { error: insertError } = await sb
      .from("pagamentos")
      .insert({
        referencia,
        user_id: user.id,
        plano_id: planoDB.id,
        tipo: isApex ? "apex" : "assinatura",
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

    // ==================================================
    // 💳 MERCADO PAGO
    // ==================================================
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
      notification_url:
        "https://www.clena.com.br/api/webhook-mercadopago",
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
      console.error("❌ ERRO MP:", mpData);
      return res.status(500).json(mpData);
    }

    // ==================================================
    // ✅ RETORNO
    // ==================================================
    return res.status(200).json({
      url: mpData.init_point,
    });

  } catch (err) {
    console.error("Erro create-payment:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
