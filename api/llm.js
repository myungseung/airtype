export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("POST only");

  if (req.headers["x-airtype-client"] !== "cli") {
    return res.status(403).send("Unauthorized");
  }

  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) return res.status(500).send("Server key missing");

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${orKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    const text = await resp.text();
    res.status(resp.status).setHeader("Content-Type", "application/json").send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
