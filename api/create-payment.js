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

    /* ==============================
       🔹 ASSINATURA
    ============================== */
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

      /* 🔹 REGISTRA NO BANCO */
      const { error: insertError } = await sb.from("pagamentos").insert({
        referencia,
        user_id: user.id,
        plano_id: planoDB.id,
        tipo: "assinatura",
        valor: planoDB.valor,
        status: "pending",
        metodo: "mercadopago",
        processado: false,
      });

      if (insertError) {
        console.error("❌ Erro ao registrar pagamento:", insertError);
        return res.status(500).json({ error: "Erro ao registrar pagamento" });
      }

      /* 🔹 CRIA CHECKOUT MERCADO PAGO */
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
              success: "https://www.clena.com.br/sucessoassinatura.html",
              failure: "https://www.clena.com.br/erroassinatura.html",
            },
            notification_url:
              "https://www.clena.com.br/api/webhook-mercadopago",
          }),
        }
      );

      const mpData = await mpRes.json();

      /* 🔹 SALVA PREFERENCE ID */
      if (mpData.id) {
        await sb
          .from("pagamentos")
          .update({ mp_preference_id: mpData.id })
          .eq("referencia", referencia);
      }

      return res.json({ url: mpData.init_point });
    }

    /* ==============================
       🔹 APEX (RECARGA)
    ============================== */
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
        .select("id, valor")
        .eq("id", plano_id)
        .single();

      if (!planoDB) {
        return res.status(404).json({ error: "Plano Apex inválido" });
      }

      const referencia = crypto.randomUUID();

      /* 🔹 REGISTRA NO BANCO */
      const { error: insertError } = await sb.from("pagamentos").insert({
        referencia,
        user_id: user.id,
        plano_id: planoDB.id,
        tipo: "apex",
        valor: planoDB.valor,
        status: "pending",
        metodo: "mercadopago",
        processado: false,
      });

      if (insertError) {
        console.error("❌ Erro ao registrar Apex:", insertError);
        return res.status(500).json({ error: "Erro ao registrar Apex" });
      }

      /* 🔹 CHECKOUT */
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
                title: "Recarga Apex - Clena TV",
                quantity: 1,
                unit_price: Number(planoDB.valor),
                currency_id: "BRL",
              },
            ],
            payer: { email },
            external_reference: referencia,
            back_urls: {
              success: "https://www.clena.com.br/sucessoapex.html",
              failure: "https://www.clena.com.br/erroapex.html",
            },
            notification_url:
              "https://www.clena.com.br/api/webhook-mercadopago",
            auto_return: "approved",
          }),
        }
      );

      const mpData = await mpRes.json();

      if (!mpData.init_point) {
        console.error("Erro Mercado Pago Apex:", mpData);
        return res.status(500).json({ error: "Erro ao criar checkout Apex" });
      }

      /* 🔹 SALVA PREFERENCE ID */
      if (mpData.id) {
        await sb
          .from("pagamentos")
          .update({ mp_preference_id: mpData.id })
          .eq("referencia", referencia);
      }

      return res.json({ url: mpData.init_point });
    }

    return res.status(400).json({ error: "Action inválida" });

  } catch (err) {
    console.error("❌ create-payment erro:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
