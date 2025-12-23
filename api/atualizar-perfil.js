import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 🔥 obrigatório
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { email, nome_usuario, username } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email obrigatório" });
  }

  const { error } = await sb
    .from("usuarios")
    .update({ nome_usuario, username })
    .eq("email", email);

  if (error) {
    console.error("❌ ERRO SUPABASE:", error);
    return res.status(500).json({
      error: "Erro ao salvar perfil",
      detalhe: error.message
    });
  }

  res.json({ ok: true });
}
