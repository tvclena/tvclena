import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { email, senha } = req.body;

    const { data, error } = await supabase
      .from("usuarios")
      .select("email, senha, status, trial_expires_at")
      .eq("email", email)
      .maybeSingle();

    if (!data) {
      return res.status(400).json({ error: "Usuário não encontrado" });
    }

    const ok = await bcrypt.compare(senha, data.senha);
    if (!ok) {
      return res.status(400).json({ error: "Senha incorreta" });
    }

    const agora = new Date();
    const expira = new Date(data.trial_expires_at);

    if (data.status !== "aprovado" && agora > expira) {
      return res.status(403).json({ error: "Teste expirado" });
    }

    return res.status(200).json({ email: data.email });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
