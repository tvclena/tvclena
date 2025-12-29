import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { email } = req.query;
  if (!email) return res.json({ saldo: 0 });

  const { data: user } = await sb
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .single();

  if (!user) return res.json({ saldo: 0 });

  const { data: carteira } = await sb
    .from("carteiras")
    .select("saldo")
    .eq("user_id", user.id)
    .single();

  res.json({ saldo: carteira?.saldo || 0 });
}
