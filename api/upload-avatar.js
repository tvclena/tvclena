import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false
  }
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: "Erro ao processar arquivo" });
    }

    const file = files.file;
    if (!file) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    try {
      const buffer = fs.readFileSync(file.filepath);

      const fileName = `avatars/${Date.now()}-${file.originalFilename}`;

      const { error: uploadError } = await supabase
        .storage
        .from("avatars")
        .upload(fileName, buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (uploadError) {
        return res.status(500).json({ error: uploadError.message });
      }

      const { data } = supabase
        .storage
        .from("avatars")
        .getPublicUrl(fileName);

      return res.status(200).json({
        avatarUrl: data.publicUrl
      });

    } catch (e) {
      return res.status(500).json({
        error: "Erro interno ao salvar avatar"
      });
    }
  });
}
