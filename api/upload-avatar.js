import formidable from "formidable";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: false }
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: "Erro no upload" });
    }

    const email = fields.email;
    const file = files.file;

    if (!email || !file) {
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const buffer = fs.readFileSync(file.filepath);

    const fileName = `${email}-${Date.now()}.png`;

    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) {
      return res.status(500).json({ error: "Erro ao salvar avatar" });
    }

    const { data: url } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    await supabase
      .from("usuarios")
      .update({ avatar_url: url.publicUrl })
      .eq("email", email);

    return res.status(200).json({ avatarUrl: url.publicUrl });
  });
}
