import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método inválido" });
  }

  const form = formidable();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ error: "Erro no upload" });
    }

    const email = fields.email;
    const file = files.file;

    if (!email || !file) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const buffer = fs.readFileSync(file.filepath);
    const ext = file.originalFilename.split(".").pop();
    const path = `avatars/${email}.${ext}`;

    await supabase.storage
      .from("avatars")
      .upload(path, buffer, {
        upsert: true,
        contentType: file.mimetype
      });

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    await supabase
      .from("usuarios")
      .update({ avatar_url: data.publicUrl })
      .eq("email", email);

    res.json({ avatarUrl: data.publicUrl });
  });
}
