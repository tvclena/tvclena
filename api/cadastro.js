import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { email, cpf, whatsapp, senha } = req.body;

  if (!email || !cpf || !whatsapp || !senha) {
    return res.status(400).json({ error: "Dados incompletos" });
  }

  // 🔍 verifica se já existe
  const { data: existe } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .single();

  if (existe) {
    return res.status(400).json({ error: "Email já cadastrado" });
  }

  const senha_hash = await bcrypt.hash(senha, 10);
  const trial = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("usuarios").insert({
    email,
    cpf,
    whatsapp,
    senha: senha_hash,
    status: "pendente",
    trial_expires_at: trial.toISOString()
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ ok: true });
}
