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

  const { email, senha } = body;

  if (!email || !senha) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("email, senha, status, trial_expires_at")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) {
    return res.status(401).json({ error: "Usuário não encontrado" });
  }

  if (data.senha !== senha) {
    return res.status(401).json({ error: "Senha incorreta" });
  }

  const agora = new Date();
  const expira = new Date(data.trial_expires_at);

  if (data.status !== "aprovado" && agora > expira) {
    return res.status(403).json({
      error: "Trial expirado. Aguarde aprovação."
    });
  }

  return res.status(200).json({
    ok: true,
    email: data.email
  });
}
