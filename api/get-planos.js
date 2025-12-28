export const config = {
  runtime: "nodejs"
};

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { data, error } = await sb
    .from("planos")
    .select("id, nome, valor")
    .eq("ativo", true)
    .eq("dias", 0)          // ✅ APEX
    .order("valor", { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
}
