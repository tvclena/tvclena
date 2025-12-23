import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método inválido" });
  }

  const { email, nome_usuario, username } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email obrigatório" });
  }

  await supabase
    .from("usuarios")
    .update({
      nome_usuario,
      username
    })
    .eq("email", email);

  res.json({ ok: true });
}
