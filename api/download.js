import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===== BUNNY STREAM =====
const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_CDN_HOST = process.env.BUNNY_CDN_HOST;

const EXPIRA_EM = 60 * 5; // 5 minutos

function gerarToken(videoId, expires) {
  const path = `/videos/${videoId}/download`;
  const hash = crypto
    .createHash("sha256")
    .update(`${BUNNY_STREAM_API_KEY}${path}${expires}`)
    .digest("hex");

  return `${hash}_${expires}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, filme_id } = req.body;

  if (!email || !filme_id) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes" });
  }

  try {
    /* ========= 1️⃣ USUÁRIO ========= */
    const { data: user } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    /* ========= 2️⃣ COMPRA DISPONÍVEL ========= */
    const { data: compra } = await supabase
      .from("movimentacoes_apex")
      .select("id")
      .eq("user_id", user.id)
      .eq("filme_id", filme_id)
      .eq("tipo", "compra_download")
      .eq("download_usado", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!compra) {
      return res.status(403).json({
        error: "Nenhum download disponível. É necessário comprar novamente."
      });
    }

    /* ========= 3️⃣ MARCA COMO USADO ========= */
    const { error: usoError } = await supabase
      .from("movimentacoes_apex")
      .update({
        download_usado: true,
        download_usado_em: new Date().toISOString()
      })
      .eq("id", compra.id);

    if (usoError) {
      return res.status(500).json({
        error: "Erro ao registrar uso do download"
      });
    }

    /* ========= 4️⃣ FILME ========= */
    const { data: filme } = await supabase
      .from("filmes")
      .select("video_url, permite_download")
      .eq("id", filme_id)
      .single();

    if (!filme || !filme.permite_download) {
      return res.status(403).json({ error: "Download não permitido" });
    }

    /* ========= 5️⃣ LINK BUNNY ========= */
    const expires = Math.floor(Date.now() / 1000) + EXPIRA_EM;
    const token = gerarToken(filme.video_url, expires);

    const url = `https://${BUNNY_CDN_HOST}/videos/${filme.video_url}/download?token=${token}`;

    return res.status(200).json({ url });

  } catch (err) {
    console.error("DOWNLOAD ERROR:", err);
    return res.status(500).json({ error: "Erro ao gerar download" });
  }
}
