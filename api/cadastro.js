import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  try {
    // 🔒 Bloqueia GET corretamente
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Variáveis de ambiente ausentes");
      return res.status(500).json({ error: "Configuração do servidor inválida" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { email, cpf, whatsapp, senha } = req.body || {};

    if (!email || !cpf || !whatsapp || !senha) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    // 🔍 verifica duplicidade
    const { data: existente, error: errBusca } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (errBusca) {
      console.error(errBusca);
      return res.status(500).json({ error: "Erro ao verificar usuário" });
    }

    if (existente) {
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
      console.error(error);
      return res.status(500).json({ error: "Erro ao salvar usuário" });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Erro fatal:", err);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
