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
    let body = Buffer.concat(chunks);

    const contentType = req.headers["content-type"];
    const boundary = contentType?.match(/boundary=(.+)/)?.[1];

    // backward compat: inject model/response_format if old client (v0.4.0) didn't send them
    if (boundary && !body.includes("name=\"model\"")) {
      const closing = Buffer.from(`--${boundary}--`);
      const idx = body.indexOf(closing);
      if (idx !== -1) {
        const extra =
          `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`;
        body = Buffer.concat([body.subarray(0, idx), Buffer.from(extra), closing, Buffer.from("\r\n")]);
      }
    }

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
