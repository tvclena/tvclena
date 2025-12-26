import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const jobName = "bloquear_assinaturas_vencidas";

  try {
    // 🔐 Proteção
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      await sb.from("cron_logs").insert({
        job: jobName,
        status: "error",
        mensagem: "unauthorized",
      });
      return res.status(401).json({ error: "unauthorized" });
    }

    // ⏰ Executa função do banco
    await sb.rpc("bloquear_assinaturas_vencidas");

    // 🧾 Log de sucesso
    await sb.from("cron_logs").insert({
      job: jobName,
      status: "success",
      mensagem: "execução concluída com sucesso",
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("Cron erro:", err);

    // 🧾 Log de erro
    await sb.from("cron_logs").insert({
      job: jobName,
      status: "error",
      mensagem: err.message || "erro desconhecido",
    });

    return res.status(500).json({ error: "cron failed" });
  }
}
