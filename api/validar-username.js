import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, username } = req.body;

  if (!username) {
    return res.status(400).json({ disponivel: false });
  }

  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("username", username)
    .neq("email", email);

  return res.status(200).json({
    disponivel: data.length === 0
  });
}
