import { readFileSync, writeFileSync, existsSync } from "fs";
import { airpath } from "./config.js";

const GLOSSARY_PATH = airpath("glossary.json");

export interface GlossaryEntry {
  /** The correct term */
  term: string;
  /** Common STT mishearings that should map to this term */
  aliases?: string[];
}

const DEFAULTS: GlossaryEntry[] = [
  // LLM providers & models
  { term: "Claude", aliases: ["clod", "claud", "cloud"] },
  { term: "Gemini", aliases: ["Jeremy", "jimmy", "jemini"] },
  { term: "GPT", aliases: ["GBT", "GPD", "gpt"] },
  { term: "GPT-4", aliases: ["GPT for", "GPT four"] },
  { term: "GPT-4o", aliases: ["GPT for oh", "GPT-4 oh"] },
  { term: "ChatGPT", aliases: ["chat GPT", "chat gpt"] },
  { term: "OpenAI", aliases: ["open AI", "open eye"] },
  { term: "Anthropic", aliases: ["anthropik", "and tropic"] },
  { term: "LLM", aliases: ["LOM", "elem", "L.L.M."] },
  { term: "Llama", aliases: ["llama", "lama"] },
  { term: "Mistral", aliases: ["mistral", "mist roll"] },
  { term: "Copilot", aliases: ["co-pilot", "co pilot"] },
  { term: "Cursor", aliases: ["curser"] },
  { term: "Windsurf", aliases: ["wind surf"] },

  // Vibe coding & dev terms
  { term: "vibe coding", aliases: ["vibe-coding", "vibecoding", "vive coding"] },
  { term: "vibe code", aliases: ["vibe-code", "vibecode", "vive code"] },
  { term: "Claude Code", aliases: ["cloud code", "clod code", "claude code"] },
  { term: "MCP", aliases: ["MTP", "NCP", "M.C.P."] },
  { term: "API", aliases: ["A.P.I.", "api"] },
  { term: "SDK", aliases: ["S.D.K.", "sdk"] },
  { term: "CLI", aliases: ["C.L.I.", "cli"] },
  { term: "npm", aliases: ["NPM", "N.P.M."] },
  { term: "Vercel", aliases: ["versal", "versatile", "ver cell"] },
  { term: "Next.js", aliases: ["next JS", "next.js", "nextjs"] },
  { term: "TypeScript", aliases: ["typescript", "type script"] },
  { term: "JavaScript", aliases: ["javascript", "java script"] },
  { term: "GitHub", aliases: ["github", "git hub", "get hub"] },
  { term: "GitHub Actions", aliases: ["github actions", "git hub actions"] },
  { term: "GitHub Copilot", aliases: ["github copilot", "git hub co-pilot"] },
  { term: "VS Code", aliases: ["VS code", "vscode", "v s code"] },
  { term: "Tailwind", aliases: ["tail wind", "tailwind"] },
  { term: "React", aliases: ["react"] },
  { term: "Node.js", aliases: ["node JS", "node.js", "nodejs"] },
  { term: "Bun", aliases: ["bun"] },
  { term: "Supabase", aliases: ["super base", "supa base"] },
  { term: "Prisma", aliases: ["prisma", "prism a"] },
  { term: "Webpack", aliases: ["web pack"] },
  { term: "Turbopack", aliases: ["turbo pack"] },
  { term: "ESLint", aliases: ["ES lint", "eslint"] },
  { term: "Prettier", aliases: ["prettier"] },

  // Common tech terms
  { term: "frontend", aliases: ["front end", "front-end"] },
  { term: "backend", aliases: ["back end", "back-end"] },
  { term: "fullstack", aliases: ["full stack", "full-stack"] },
  { term: "localhost", aliases: ["local host"] },
  { term: "webhook", aliases: ["web hook"] },
  { term: "middleware", aliases: ["middle ware"] },
  { term: "serverless", aliases: ["server less"] },
  { term: "README", aliases: ["read me", "readme"] },
  { term: "refactor", aliases: ["re-factor"] },
  { term: "deploy", aliases: ["the ploy"] },
  { term: "repo", aliases: ["repository"] },

  // Airtype specific
  { term: "Airtype", aliases: ["air type", "airtype", "air-type"] },
];

export function loadGlossary(): GlossaryEntry[] {
  if (existsSync(GLOSSARY_PATH)) {
    try {
      return JSON.parse(readFileSync(GLOSSARY_PATH, "utf-8"));
    } catch {}
  }
  // First run: write defaults
  saveGlossary(DEFAULTS);
  return DEFAULTS;
}

export function saveGlossary(entries: GlossaryEntry[]): void {
  writeFileSync(GLOSSARY_PATH, JSON.stringify(entries, null, 2));
}

/** Build a Whisper prompt hint string from glossary terms */
export function buildWhisperHint(entries: GlossaryEntry[]): string {
  return entries.map(e => e.term).join(", ");
}

/** Build a glossary block for the LLM system prompt */
export function buildLlmGlossary(entries: GlossaryEntry[]): string {
  const lines = entries
    .filter(e => e.aliases && e.aliases.length > 0)
    .map(e => `- ${e.aliases!.join(", ")} -> ${e.term}`);
  return lines.join("\n");
}
