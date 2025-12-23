import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string"
    ? JSON.parse(req.body)
    : req.body;

  const { email } = body;

  if (!email) {
    return res.status(400).json({ error: "Email ausente" });
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("status, trial_expires_at, whatsapp")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return res.status(401).json({ error: "Sessão inválida" });
  }

  const agora = new Date();
  const expira = new Date(data.trial_expires_at);

  if (data.status === "bloqueado") {
    return res.status(403).json({
      bloqueado: true,
      whatsapp: data.whatsapp || ""
    });
  }

  if (agora > expira && data.status !== "aprovado") {
    return res.status(403).json({
      expirado: true
    });
  }

  return res.status(200).json({
    ok: true
  });
}
