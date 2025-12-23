import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { fileBase64, userId } = req.body;

  if (!fileBase64 || !userId) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const buffer = Buffer.from(
    fileBase64.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  const nome = `${userId}_${Date.now()}.jpg`;

  const uploadUrl =
    `https://storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/avatars/${nome}`;

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "AccessKey": process.env.BUNNY_STORAGE_KEY,
      "Content-Type": "application/octet-stream"
    },
    body: buffer
  });

  if (!upload.ok) {
    return res.status(500).json({ error: "Erro Bunny" });
  }

  const avatarUrl =
    `${process.env.BUNNY_CDN_URL}/avatars/${nome}`;

  return res.json({ avatarUrl });
}
