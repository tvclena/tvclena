export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fileBase64, filename } = req.body;

  if (!fileBase64 || !filename) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const buffer = Buffer.from(fileBase64, "base64");

  const uploadUrl =
    `https://br.storage.bunnycdn.com/sessao99/avatars/${filename}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: process.env.BUNNY_ACCESS_KEY,
      "Content-Type": "application/octet-stream"
    },
    body: buffer
  });

  if (!response.ok) {
    const text = await response.text();
    return res.status(500).json({
      error: "Erro Bunny",
      status: response.status,
      detail: text
    });
  }

  return res.json({
    url: `https://sessao99.b-cdn.net/avatars/${filename}`
  });
}
