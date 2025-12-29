export const config = { runtime: "nodejs" };

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

    const { action } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action ausente" });
    }

    /* ======================================================
       🔹 ASSINATURA (PLANOS)
    ====================================================== */
    if (action === "assinatura") {
      const { email, plano } = req.body;

      if (!email || !plano) {
        return res.status(400).json({ error: "Dados ausentes" });
      }

      const { data: user } = await sb
        .from("usuarios")
        .select("id")
        .eq("email", email)
        .single();

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

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

      await sb.from("pagamentos").insert({
        referencia,
        user_id: user.id,
        plano_id: planoDB.id,
        tipo: "assinatura",
        valor: planoDB.valor,
        status: "pending",
        processado: false,
      });

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
      return res.json({ url: mpData.init_point });
    }

    /* ======================================================
       🔹 APEX (RECARGA DE CARTEIRA)
    ====================================================== */
    if (action === "apex") {
      const { email, plano_id } = req.body;

      if (!email || !plano_id) {
        return res.status(400).json({ error: "Dados ausentes" });
      }

      const { data: user } = await sb
        .from("usuarios")
        .select("id")
        .eq("email", email)
        .single();

      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      const { data: planoDB } = await sb
        .from("planos")
        .select("valor")
        .eq("id", plano_id)
        .single();

      if (!planoDB) {
        return res.status(404).json({ error: "Plano Apex inválido" });
      }

      const referencia = crypto.randomUUID();
      const apex = planoDB.valor * 15;

      await sb.from("pagamentos").insert({
        referencia,
        user_id: user.id,
        plano_id,
        tipo: "apex",
        valor: planoDB.valor,
        status: "pending",
        processado: false,
      });

      // Mercado Pago (opcional)
      // OU retorno direto se quiser simular

      return res.json({
        success: true,
        referencia,
        apex
      });
    }

    return res.status(400).json({ error: "Action inválida" });

  } catch (err) {
    console.error("❌ create-payment erro:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
