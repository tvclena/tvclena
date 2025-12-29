import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ⚠️ NÃO anon
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ error: "Email obrigatório" });
  }

  // 1️⃣ buscar usuário
  const { data: user, error: userError } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .single();

  if (userError || !user) {
    return res.status(404).json({ apex: 0 });
  }

  // 2️⃣ buscar carteira
  const { data: carteira } = await supabase
    .from("carteiras")
    .select("saldo")
    .eq("user_id", user.id)
    .single();

  return res.status(200).json({
    apex: carteira?.saldo ?? 0
  });
}
