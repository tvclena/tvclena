import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    await sb.rpc("bloquear_assinaturas_vencidas");
    return res.json({ ok: true });
  } catch (err) {
    console.error("Cron erro:", err);
    return res.status(500).json({ error: "cron failed" });
  }
}
