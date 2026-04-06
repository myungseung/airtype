export default async function handler(req) {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  if (req.headers.get("x-airtype-client") !== "cli") {
    return new Response("Unauthorized", { status: 403 });
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return new Response("Server key missing", { status: 500 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file) return new Response("No file", { status: 400 });

  const proxyForm = new FormData();
  proxyForm.append("file", file, "audio.wav");
  proxyForm.append("model", "whisper-large-v3");
  proxyForm.append("response_format", "json");

  const lang = formData.get("language");
  if (lang && lang !== "auto") proxyForm.append("language", lang);

  const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: proxyForm,
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: { "Content-Type": "application/json" },
  });
}
