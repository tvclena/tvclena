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
  const form = formidable();

  form.parse(req, async (err, fields, files) => {
    const email = fields.email;
    const file = files.file;

    const buffer = fs.readFileSync(file.filepath);
    const fileName = `${email}.jpg`;

    await supabase.storage
      .from("avatars")
      .upload(fileName, buffer, { upsert: true });

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    await supabase
      .from("usuarios")
      .update({ avatar_url: data.publicUrl })
      .eq("email", email);

    res.json({ avatarUrl: data.publicUrl });
  });
}
