import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { session_token, desafiar_username } = req.body;

    if (!session_token || !desafiar_username) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    /* ================= VALIDAR SESSÃO ================= */
    const { data: user, error: userError } = await sb
      .from("usuarios")
      .select("id, username")
      .eq("session_token", session_token)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: "Sessão inválida" });
    }

    if (!user.username) {
      return res.status(400).json({ error: "Usuário sem @" });
    }

    /* ================= BUSCAR DESAFIADO ================= */
    const usernameLimpo = desafiar_username.replace("@", "").toLowerCase();

    if (usernameLimpo === user.username) {
      return res.status(400).json({ error: "Não pode desafiar você mesmo" });
    }

    const { data: alvo, error: alvoError } = await sb
      .from("usuarios")
      .select("id")
      .eq("username", usernameLimpo)
      .single();

    if (alvoError || !alvo) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    /* ================= CRIAR DESAFIO ================= */
    const { data: desafioId, error: desafioError } = await sb
      .rpc("criar_desafio", {
        p_jogo: "jogo_da_velha",
        p_desafiante: user.id,
        p_desafiado: alvo.id,
        p_entrada: 60,
        p_premio: 100
      });

    if (desafioError) {
      console.error(desafioError);
      return res.status(500).json({ error: "Erro ao criar desafio" });
    }

    return res.status(200).json({
      ok: true,
      desafio_id: desafioId
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro interno" });
  }
}
