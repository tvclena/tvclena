import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { userId, fileBase64 } = req.body;

    if (!userId || !fileBase64) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    // 🔥 remove prefixo base64
    const base64Data = fileBase64.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");

    const fileName = `${userId}_${Date.now()}.jpg`;

    const uploadUrl =
      `https://${process.env.BUNNY_REGION}.storage.bunnycdn.com/` +
      `${process.env.BUNNY_STORAGE_ZONE}/avatars/${fileName}`;

    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: process.env.BUNNY_ACCESS_KEY,
        "Content-Type": "application/octet-stream"
      },
      body: buffer
    });

    if (!upload.ok) {
      const text = await upload.text();
      return res.status(500).json({
        error: "Erro no upload Bunny",
        details: text
      });
    }

    const avatarUrl =
      `${process.env.NEXT_PUBLIC_BUNNY_PULL_ZONE}/avatars/${fileName}`;

    return res.status(200).json({ avatarUrl });

  } catch (err) {
    return res.status(500).json({
      error: "Erro interno",
      message: err.message
    });
  }
}
