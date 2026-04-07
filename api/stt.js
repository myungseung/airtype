export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("POST only");

  if (req.headers["x-airtype-client"] !== "cli") {
    return res.status(403).send("Unauthorized");
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(500).send("Server key missing");

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const contentType = req.headers["content-type"];

    const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": contentType,
      },
      body,
    });

    const text = await resp.text();
    res.status(resp.status).setHeader("Content-Type", "application/json").send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
