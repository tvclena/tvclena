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
    // 🔹 LISTAR PLANOS APEX
    // =====================================
if (req.method === "POST" && req.body?.action === "list_apex") {
  const { data, error } = await sb
    .from("planos")
    .select("id, valor")
    .eq("ativo", true)
    .eq("dias", 0)
    .order("valor");

  if (error) return res.status(500).json([]);
  return res.status(200).json(data || []);
}

    // =====================================
    // 🔻 PAGAMENTO
    // =====================================
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método inválido" });
    }

const { action, plano_id, plano, email } = req.body;

if (!email) {
  return res.status(400).json({ error: "Email ausente" });
}

const isApex = action === "apex_payment";

let planoQuery = sb
  .from("planos")
  .select("*")
  .eq("ativo", true);

if (isApex) {
  if (!plano_id) {
    return res.status(400).json({ error: "Plano Apex ausente" });
  }

  planoQuery = planoQuery
    .eq("id", plano_id)
    .eq("dias", 0);
}

else {
  if (!plano) {
    return res.status(400).json({ error: "Plano ausente" });
  }

  planoQuery = planoQuery
    .eq("nome", plano)
    .gt("dias", 0);
}

const { data: planoDB, error: planoError } =
  await planoQuery.single();

if (planoError || !planoDB) {
  return res.status(400).json({ error: "Plano inválido" });
}


    // =====================================
    // 🔎 USUÁRIO
    // =====================================
    const { data: user } = await sb
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    // =====================================
    // 🧾 REGISTRA PAGAMENTO
    // =====================================
    const referencia = crypto.randomUUID();

    await sb.from("pagamentos").insert({
      referencia,
      user_id: user.id,
      plano_id: planoDB.id,
      tipo: isApex ? "apex" : "assinatura",
      valor: planoDB.valor,
      status: "pending",
      processado: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // =====================================
    // 💳 MERCADO PAGO
    // =====================================
    const mpRes = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{
            title: isApex ? "Recarga Apex" : planoDB.nome,
            quantity: 1,
            unit_price: Number(planoDB.valor),
            currency_id: "BRL",
          }],
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

    if (!mpRes.ok) {
      console.error("Erro MP:", mpData);
      return res.status(500).json(mpData);
    }

    return res.status(200).json({ url: mpData.init_point });

  } catch (err) {
    console.error("Erro create-payment:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
