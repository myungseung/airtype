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
  // ── LLM providers & models ──
  { term: "Claude", aliases: ["clod", "claud", "cloud"] },
  { term: "Claude Opus", aliases: ["cloud opus", "clod opus"] },
  { term: "Claude Sonnet", aliases: ["cloud sonnet", "clod sonnet"] },
  { term: "Claude Haiku", aliases: ["cloud haiku", "clod haiku"] },
  { term: "Gemini", aliases: ["Jeremy", "jimmy", "jemini"] },
  { term: "GPT", aliases: ["GBT", "GPD", "gpt"] },
  { term: "GPT-4", aliases: ["GPT for", "GPT four"] },
  { term: "GPT-4o", aliases: ["GPT for oh", "GPT-4 oh"] },
  { term: "o1", aliases: ["oh one", "O1"] },
  { term: "o3", aliases: ["oh three", "O3"] },
  { term: "ChatGPT", aliases: ["chat GPT", "chat gpt"] },
  { term: "OpenAI", aliases: ["open AI", "open eye"] },
  { term: "Anthropic", aliases: ["anthropik", "and tropic", "anthropick"] },
  { term: "LLM", aliases: ["LOM", "elem", "L.L.M."] },
  { term: "Llama", aliases: ["llama", "lama"] },
  { term: "Mistral", aliases: ["mistral", "mist roll"] },
  { term: "Grok", aliases: ["groc", "grock"] },
  { term: "Perplexity", aliases: ["perplexity", "perplex city"] },
  { term: "DeepSeek", aliases: ["deep seek", "deep-seek"] },
  { term: "Stable Diffusion", aliases: ["stable diffusion"] },
  { term: "Midjourney", aliases: ["mid journey", "mid-journey"] },
  { term: "DALL-E", aliases: ["dolly", "doll e", "dall e"] },
  { term: "Whisper", aliases: ["whisper"] },
  { term: "Copilot", aliases: ["co-pilot", "co pilot"] },
  { term: "Cursor", aliases: ["curser"] },
  { term: "Windsurf", aliases: ["wind surf"] },
  { term: "Replit", aliases: ["rep lit", "repl it"] },
  { term: "Devin", aliases: ["Devon"] },
  { term: "v0", aliases: ["V zero", "v zero", "V0"] },
  { term: "Bolt", aliases: ["bolt"] },
  { term: "Lovable", aliases: ["loveable"] },

  // ── AI/ML concepts ──
  { term: "RAG", aliases: ["rag", "R.A.G."] },
  { term: "fine-tuning", aliases: ["fine tuning"] },
  { term: "embeddings", aliases: ["embedding"] },
  { term: "vector database", aliases: ["vector DB"] },
  { term: "prompt engineering", aliases: ["prompt engineer"] },
  { term: "tokens", aliases: ["token"] },
  { term: "context window", aliases: ["context windows"] },
  { term: "hallucination", aliases: ["hallucinations"] },
  { term: "inference", aliases: ["in France"] },
  { term: "transformer", aliases: ["transformers"] },
  { term: "agentic", aliases: ["a genetic", "agent ik"] },
  { term: "multi-modal", aliases: ["multimodal", "multi modal"] },
  { term: "tool calling", aliases: ["tool-calling"] },
  { term: "function calling", aliases: ["function-calling"] },
  { term: "chain of thought", aliases: ["chain-of-thought"] },
  { term: "zero-shot", aliases: ["zero shot"] },
  { term: "few-shot", aliases: ["few shot"] },

  // ── Vibe coding & dev tools ──
  { term: "vibe coding", aliases: ["vibe-coding", "vibecoding", "vive coding"] },
  { term: "vibe code", aliases: ["vibe-code", "vibecode", "vive code"] },
  { term: "Claude Code", aliases: ["cloud code", "clod code", "claude code"] },
  { term: "MCP", aliases: ["MTP", "NCP", "M.C.P."] },
  { term: "API", aliases: ["A.P.I.", "api"] },
  { term: "REST API", aliases: ["rest API", "restful API"] },
  { term: "GraphQL", aliases: ["graph QL", "graph cool"] },
  { term: "SDK", aliases: ["S.D.K.", "sdk"] },
  { term: "CLI", aliases: ["C.L.I.", "cli"] },
  { term: "npm", aliases: ["NPM", "N.P.M."] },
  { term: "pnpm", aliases: ["P NPM", "p-npm"] },
  { term: "yarn", aliases: ["YARN"] },
  { term: "Vercel", aliases: ["versal", "versatile", "ver cell", "ver sell"] },
  { term: "Netlify", aliases: ["netlify", "net lify"] },
  { term: "AWS", aliases: ["A.W.S.", "aws"] },
  { term: "Next.js", aliases: ["next JS", "next.js", "nextjs"] },
  { term: "Nuxt", aliases: ["next", "nukes"] },
  { term: "SvelteKit", aliases: ["svelte kit", "svelt kit"] },
  { term: "Astro", aliases: ["astro"] },
  { term: "TypeScript", aliases: ["typescript", "type script"] },
  { term: "JavaScript", aliases: ["javascript", "java script"] },
  { term: "Python", aliases: ["python"] },
  { term: "Rust", aliases: ["rust"] },
  { term: "Go", aliases: ["golang"] },
  { term: "GitHub", aliases: ["github", "git hub", "get hub"] },
  { term: "GitHub Actions", aliases: ["github actions", "git hub actions"] },
  { term: "GitHub Copilot", aliases: ["github copilot", "git hub co-pilot"] },
  { term: "GitLab", aliases: ["git lab"] },
  { term: "VS Code", aliases: ["VS code", "vscode", "v s code"] },
  { term: "JetBrains", aliases: ["jet brains"] },
  { term: "Tailwind", aliases: ["tail wind", "tailwind"] },
  { term: "Tailwind CSS", aliases: ["tailwind CSS", "tail wind CSS"] },
  { term: "shadcn", aliases: ["shad CN", "shad see en", "shadow CN"] },
  { term: "React", aliases: ["react"] },
  { term: "Vue", aliases: ["view", "vue"] },
  { term: "Svelte", aliases: ["svelt"] },
  { term: "Angular", aliases: ["angular"] },
  { term: "Node.js", aliases: ["node JS", "node.js", "nodejs"] },
  { term: "Deno", aliases: ["Deano", "dino"] },
  { term: "Bun", aliases: ["bun"] },
  { term: "Express", aliases: ["express"] },
  { term: "Hono", aliases: ["hoe no", "ho no"] },
  { term: "FastAPI", aliases: ["fast API", "fast api"] },
  { term: "Django", aliases: ["jango"] },
  { term: "Flask", aliases: ["flask"] },

  // ── Databases & storage ──
  { term: "Supabase", aliases: ["super base", "supa base"] },
  { term: "Firebase", aliases: ["fire base"] },
  { term: "Prisma", aliases: ["prisma", "prism a"] },
  { term: "Drizzle", aliases: ["drizzle"] },
  { term: "PostgreSQL", aliases: ["postgres", "post gress", "postgre SQL"] },
  { term: "MySQL", aliases: ["my SQL", "my sequel"] },
  { term: "MongoDB", aliases: ["mongo DB", "mongo"] },
  { term: "Redis", aliases: ["red is", "reddis"] },
  { term: "SQLite", aliases: ["SQL lite", "sequel lite"] },
  { term: "Neon", aliases: ["neon"] },
  { term: "PlanetScale", aliases: ["planet scale"] },
  { term: "Upstash", aliases: ["up stash"] },
  { term: "Pinecone", aliases: ["pine cone"] },
  { term: "Weaviate", aliases: ["we V8"] },
  { term: "Chroma", aliases: ["chroma"] },

  // ── Build & infra tools ──
  { term: "Webpack", aliases: ["web pack"] },
  { term: "Turbopack", aliases: ["turbo pack"] },
  { term: "Turborepo", aliases: ["turbo repo"] },
  { term: "Vite", aliases: ["veet", "vight"] },
  { term: "esbuild", aliases: ["ES build"] },
  { term: "ESLint", aliases: ["ES lint", "eslint"] },
  { term: "Prettier", aliases: ["prettier"] },
  { term: "Biome", aliases: ["biome"] },
  { term: "Docker", aliases: ["docker", "darker"] },
  { term: "Kubernetes", aliases: ["kubernetes", "K8s", "k8s"] },
  { term: "Terraform", aliases: ["terra form"] },
  { term: "CI/CD", aliases: ["CI CD", "CICD", "C.I.C.D."] },
  { term: "monorepo", aliases: ["mono repo", "mono-repo"] },

  // ── Auth & services ──
  { term: "OAuth", aliases: ["O auth", "oh auth"] },
  { term: "JWT", aliases: ["J.W.T.", "JOT"] },
  { term: "Auth0", aliases: ["auth zero", "auth 0"] },
  { term: "Clerk", aliases: ["clerk"] },
  { term: "Stripe", aliases: ["stripe"] },
  { term: "Twilio", aliases: ["twilio", "Twi Leo"] },
  { term: "SendGrid", aliases: ["send grid"] },
  { term: "Resend", aliases: ["resend", "re-send"] },
  { term: "Sentry", aliases: ["sentry", "century"] },
  { term: "PostHog", aliases: ["post hog", "posthog"] },
  { term: "Datadog", aliases: ["data dog"] },
  { term: "Grafana", aliases: ["grafana"] },
  { term: "Cloudflare", aliases: ["cloud flare", "cloudflare"] },

  // ── Common dev terms ──
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
  { term: "codebase", aliases: ["code base"] },
  { term: "boilerplate", aliases: ["boiler plate"] },
  { term: "linting", aliases: ["lint ing"] },
  { term: "debugging", aliases: ["debug ing", "de-bugging"] },
  { term: "hot reload", aliases: ["hot-reload"] },
  { term: "SSR", aliases: ["S.S.R.", "server side rendering"] },
  { term: "SSG", aliases: ["S.S.G.", "static site generation"] },
  { term: "ISR", aliases: ["I.S.R."] },
  { term: "CSR", aliases: ["C.S.R.", "client side rendering"] },
  { term: "SEO", aliases: ["S.E.O.", "seo"] },
  { term: "CRUD", aliases: ["C.R.U.D.", "crud"] },
  { term: "ORM", aliases: ["O.R.M.", "orm"] },
  { term: "env", aliases: [".env", "dot env"] },
  { term: "async/await", aliases: ["async await", "a sync await"] },
  { term: "TypeScript", aliases: ["TS"] },
  { term: "JSX", aliases: ["J.S.X."] },
  { term: "TSX", aliases: ["T.S.X."] },
  { term: "JSON", aliases: ["J.S.O.N.", "jason"] },
  { term: "YAML", aliases: ["Y.A.M.L.", "yamel"] },
  { term: "TOML", aliases: ["T.O.M.L."] },
  { term: "regex", aliases: ["regular expression", "reg ex"] },
  { term: "DevOps", aliases: ["dev ops", "dev-ops"] },
  { term: "SaaS", aliases: ["sass", "S.A.A.S."] },
  { term: "open source", aliases: ["open-source"] },
  { term: "pull request", aliases: ["PR", "P.R."] },
  { term: "code review", aliases: ["code-review"] },
  { term: "tech debt", aliases: ["technical debt"] },
  { term: "sprint", aliases: ["sprint"] },
  { term: "standup", aliases: ["stand up", "stand-up"] },
  { term: "Agile", aliases: ["agile"] },
  { term: "Scrum", aliases: ["scrum"] },

  // ── Airtype specific ──
  { term: "Airtype", aliases: ["air type", "airtype", "air-type"] },
  { term: "Superdots", aliases: ["super dots", "super."] },
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

const WHISPER_PROMPT_LIMIT = 880;

/** Build a Whisper prompt hint string from glossary terms (within 896 char limit) */
export function buildWhisperHint(entries: GlossaryEntry[]): string {
  // Prioritize terms that have aliases (most likely to be misheared)
  const prioritized = [
    ...entries.filter(e => e.aliases && e.aliases.length >= 2),
    ...entries.filter(e => e.aliases && e.aliases.length === 1),
    ...entries.filter(e => !e.aliases || e.aliases.length === 0),
  ];
  const terms: string[] = [];
  let len = 0;
  for (const e of prioritized) {
    const add = (terms.length > 0 ? 2 : 0) + e.term.length; // ", " + term
    if (len + add > WHISPER_PROMPT_LIMIT) break;
    terms.push(e.term);
    len += add;
  }
  return terms.join(", ");
}

/** Build a glossary block for the LLM system prompt */
export function buildLlmGlossary(entries: GlossaryEntry[]): string {
  const lines = entries
    .filter(e => e.aliases && e.aliases.length > 0)
    .map(e => `- ${e.aliases!.join(", ")} -> ${e.term}`);
  return lines.join("\n");
}
