import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res){
  try{
    const { data, error } = await sb
      .from("planos")
      .select("nome, valor")
      .eq("ativo", true)
      .eq("dias", 0)
      .order("valor", { ascending: true });

    if(error){
      return res.status(500).json([]);
    }

    return res.json(data || []);

  }catch(err){
    return res.status(500).json([]);
  }
}
