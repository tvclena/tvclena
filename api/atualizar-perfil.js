import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { email, nome_usuario, username } = req.body;

  await supabase
    .from("usuarios")
    .update({ nome_usuario, username })
    .eq("email", email);

  res.json({ ok: true });
}
