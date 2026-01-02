// /api/upload-avatar.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { fileBase64, userId } = req.body;

  if (!fileBase64 || !userId) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const buffer = Buffer.from(fileBase64, "base64");
  const nome = `${userId}_${Date.now()}.jpg`;

  const uploadUrl =
    `https://br.storage.bunnycdn.com/sessao99/avatars/${nome}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: process.env.BUNNY_STORAGE_KEY,
      "Content-Type": "application/octet-stream"
    },
    body: buffer
  });

  if (!response.ok) {
    return res.status(500).json({ error: "Erro no Bunny" });
  }

  const publicUrl =
    `https://sessao99.b-cdn.net/avatars/${nome}`;

  res.json({ url: publicUrl });
}
