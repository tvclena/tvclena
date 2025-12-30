import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 🔐 backend only
);

// conversão oficial (igual frontend)
const APEX_POR_REAL = 15;

function apexParaReais(apex) {
  return Number(apex) / APEX_POR_REAL;
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
    /* ================= 1️⃣ USUÁRIO ================= */
    const { data: user, error: userError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    /* ================= 2️⃣ FILME ================= */
    const { data: filme, error: filmeError } = await supabase
      .from("filmes")
      .select("id, titulo, valor_apex, permite_download")
      .eq("id", filme_id)
      .single();

    if (filmeError || !filme) {
      return res.status(404).json({ error: "Filme não encontrado" });
    }

    if (!filme.permite_download || !filme.valor_apex) {
      return res.status(403).json({
        error: "Download não permitido para este conteúdo"
      });
    }

    const valorApex = Number(filme.valor_apex);
    const valorReal = apexParaReais(valorApex);

    /* ================= 3️⃣ CARTEIRA ================= */
    const { data: carteira, error: cartError } = await supabase
      .from("carteiras")
      .select("saldo")
      .eq("user_id", user.id)
      .single();

    const saldoAtual = Number(carteira?.saldo || 0);

    if (saldoAtual < valorReal) {
      return res.status(402).json({
        error: "Saldo insuficiente",
        saldo: saldoAtual
      });
    }

    const saldoDepois = saldoAtual - valorReal;

    /* ================= 4️⃣ TRANSAÇÃO ================= */
    const { error: txError } = await supabase.rpc(
      "comprar_download_apex",
      {
        p_user_id: user.id,
        p_filme_id: filme.id,
        p_valor_apex: valorApex,
        p_valor_real: valorReal,
        p_saldo_antes: saldoAtual,
        p_saldo_depois: saldoDepois
      }
    );

    if (txError) {
      console.error("TX ERROR:", txError);
      return res.status(500).json({ error: "Erro ao processar compra" });
    }

    /* ================= 5️⃣ OK ================= */
    return res.status(200).json({
      ok: true,
      filme: filme.titulo,
      valor_apex: valorApex,
      saldo_restante: saldoDepois
    });

  } catch (e) {
    console.error("ERRO GERAL:", e);
    return res.status(500).json({ error: "Erro interno" });
  }
}
