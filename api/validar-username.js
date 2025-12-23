import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método inválido" });
  }

  const { email, username } = req.body;

  if (!username) {
    return res.status(400).json({ disponivel: false });
  }

  const { data } = await supabase
    .from("usuarios")
    .select("id,email")
    .eq("username", username)
    .maybeSingle();

  if (!data) {
    return res.json({ disponivel: true });
  }

  if (data.email === email) {
    return res.json({ disponivel: true });
  }

  return res.json({ disponivel: false });
}
