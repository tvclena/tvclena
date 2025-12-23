import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email ausente" });
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select(`
      id,
      email,
      nome_usuario,
      username,
      avatar_url,
      tipo_assinatura,
      valor_assinatura,
      vencimento_assinatura
    `)
    .eq("email", email)
    .single();

  if (error || !data) {
    return res.status(401).json({ error: "Usuário inválido" });
  }

  return res.status(200).json(data);
}
