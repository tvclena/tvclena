import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { email, senha } = req.body;

  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .eq("senha", senha)
    .maybeSingle();

  if (!data) {
    return res.status(401).json({ error: "Login inválido" });
  }

  res.json({ email });
}
