const PROXY_URL = "https://airtype-xi.vercel.app/api/stt";

export interface SttResult {
  text: string;
  durationMs: number;
}

export async function transcribe(wavBuffer: Buffer, language: string): Promise<SttResult> {
  const start = Date.now();

  const formData = new FormData();
  formData.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "audio.wav");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "json");
  if (language && language !== "auto") {
    formData.append("language", language);
  }

  const resp = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "x-airtype-client": "cli" },
    body: formData,
  });

  const body = await resp.text();
  const durationMs = Date.now() - start;

  if (!resp.ok) {
    throw new Error(`STT failed (${resp.status}): ${body}`);
  }

  const parsed = JSON.parse(body);
  return { text: parsed.text || "", durationMs };
}
