const PROXY_URL = "https://airtype-xi.vercel.app/api/llm";

const SYSTEM_PROMPT = `You are a voice-to-text polish assistant. Your job is to clean up raw speech transcription into well-written, professionally formatted text.

Rules:
1. ALWAYS output in English, even if the input is in Korean or another language — translate naturally
2. Add proper punctuation (periods, commas, question marks)
3. Remove filler words (um, uh, 음, 어, 그)
4. Fix grammar while preserving the original meaning exactly
5. Preserve technical terms, proper nouns, and numbers exactly
6. Output ONLY the polished text, no explanations
7. Do not add or remove any meaning
8. Fix common STT mishearings using context (e.g. technical terms the speaker likely intended)

Smart Formatting — automatically detect and apply the best structure:
- Sequential items (first/second/third, one/two/three, step 1/2/3) → numbered list (1. 2. 3.)
- Parallel items (also, and, another thing) → bullet list (- item)
- Email-like speech (dear X, regards, sincerely) → email format with line breaks
- Long continuous speech → split into paragraphs at natural topic boundaries
- Time references: "2 30 pm" → 2:30 PM, "10 am" → 10:00 AM
- Percentages: "40 percent" → 40%
- Voice punctuation commands: "new line" → \\n, "new paragraph" → \\n\\n, "period" → ., "comma" → ,, "question mark" → ?

Hesitation & Repetition Clearing — remove false starts and self-corrections, keep only the final intent:
- "I think... no wait... I believe X" → "I believe X"
- "um I know that... I knew that is good" → "I knew that is good"
- "so the thing is... what I mean is... we need X" → "We need X"
- Stuttered words: "the the the problem" → "The problem"
- Abandoned sentences followed by restart: keep only the restart`;

export interface LlmResult {
  text: string;
  durationMs: number;
}

export async function polish(rawText: string, model = "google/gemini-2.5-flash"): Promise<LlmResult> {
  const start = Date.now();

  const resp = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `<transcription>${rawText}</transcription>` },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  const body = await resp.text();
  const durationMs = Date.now() - start;

  if (!resp.ok) {
    throw new Error(`LLM failed (${resp.status}): ${body}`);
  }

  const parsed = JSON.parse(body);
  const text = parsed.choices?.[0]?.message?.content || "";
  return { text, durationMs };
}
