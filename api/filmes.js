import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from("filmes")
      .select(`
        id,
        titulo,
        serie_nome,
        tipo,
        categoria,
        capa_url,
        descricao,
        video_url,
        classificacao,
        ano_lancamento,
        nota_critica,
        duracao_minutos,
        idioma,
        audio,
        ativo
      `)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro interno" });
  }
}
