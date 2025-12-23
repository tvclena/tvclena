import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email ausente" });
  }

  const { data } = await supabase
    .from("usuarios")
    .select("status, trial_expires_at")
    .eq("email", email)
    .maybeSingle();

  if (!data) {
    return res.status(401).json({ error: "Sessão inválida" });
  }

  if (data.status === "bloqueado") {
    return res.status(403).json({ bloqueado: true });
  }

  if (data.trial_expires_at && new Date() > new Date(data.trial_expires_at)) {
    return res.status(403).json({ expirado: true });
  }

  res.json({ ok: true });
}
