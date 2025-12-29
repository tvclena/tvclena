export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Método inválido" });
    }

    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email obrigatório" });
    }

    // 1️⃣ Buscar usuário
    const { data: user, error: userError } = await sb
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ saldo: 0, apex: 0 });
    }
  // 2️⃣ Buscar carteira
    // 2️⃣ Buscar carteira
    const { data: carteira, error: cartError } = await sb
      .from("carteiras")
      .select("saldo")
      .eq("user_id", user.id)
      .maybeSingle();

    const saldo = carteira?.saldo ? Number(carteira.saldo) : 0;

    // 3️⃣ Conversão Apex
    const apex = saldo * 15;

    return res.status(200).json({
      saldo,
      apex,
    });

  } catch (err) {
    console.error("Erro API carteira:", err);
    return res.status(500).json({ saldo: 0, apex: 0 });
  }
}
