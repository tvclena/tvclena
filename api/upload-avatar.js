export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { fileBase64, userId } = req.body;

  const buffer = Buffer.from(
    fileBase64.split(",")[1],
    "base64"
  );

  const fileName = `${userId}_${Date.now()}.jpg`;
  const path = `avatars/${fileName}`;

  const uploadUrl =
    `https://br.storage.bunnycdn.com/sessao99/${path}`;

  const r = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: process.env.BUNNY_ACCESS_KEY,
      "Content-Type": "image/jpeg"
    },
    body: buffer
  });

  if (!r.ok) {
    return res.status(500).json({ error: "Upload falhou" });
  }

  return res.json({
    avatarUrl: `https://sessao99.b-cdn.net/${path}`
  });
}
