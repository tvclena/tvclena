import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 🔥 OBRIGATÓRIO
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
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
    const fileName = `avatars/${email}.${ext}`;

    // ⬆️ UPLOAD NO STORAGE
    const { error: uploadError } = await supabase
      .storage
      .from("avatars")
      .upload(fileName, buffer, {
        upsert: true,
        contentType: file.mimetype
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data } = supabase
      .storage
      .from("avatars")
      .getPublicUrl(fileName);

    // 💾 SALVA NO BANCO
    await supabase
      .from("usuarios")
      .update({ avatar_url: data.publicUrl })
      .eq("email", email);

    return res.json({ avatarUrl: data.publicUrl });
  });
}
