import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { email, username } = req.body;

  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("username", username)
    .neq("email", email)
    .maybeSingle();

  res.json({ disponivel: !data });
}
