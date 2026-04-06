export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) return new Response("Server key missing", { status: 500 });

  const body = await req.text();

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${orKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
