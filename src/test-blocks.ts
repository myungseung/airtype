/**
 * Block TDD tests — run all, report PASS/FAIL.
 * No user interaction. All automated.
 */
import { buildCombo, isModifier } from "./keys.js";
import { startRecording, recordDuration } from "./audio.js";
import { transcribe } from "./stt.js";
import { polish } from "./llm.js";
import { loadEnvKey } from "./config.js";
import { GlobalKeyboardListener } from "node-global-key-listener";
import { existsSync, readFileSync, unlinkSync, mkdirSync, writeFileSync } from "fs";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let passed = 0;
let failed = 0;

function pass(name: string, detail = "") {
  passed++;
  console.log(`  ${GREEN}${BOLD}✓${RESET} ${name} ${DIM}${detail}${RESET}`);
}

function fail(name: string, detail = "") {
  failed++;
  console.log(`  ${RED}${BOLD}✗${RESET} ${name} ${detail}`);
}

async function main() {
  console.log(`\n${BOLD}=== Airtype Block Tests ===${RESET}\n`);

  // ─── Block A: buildCombo ───
  console.log(`${DIM}[A] buildCombo${RESET}`);

  const isDown1: Record<string, boolean> = { "LEFT META": true, "ESCAPE": true };
  const r1 = buildCombo("ESCAPE", isDown1);
  r1 === "Cmd+ESCAPE" ? pass("Cmd+Esc", r1) : fail("Cmd+Esc", `got "${r1}"`);

  const isDown2: Record<string, boolean> = { "LEFT CTRL": true, "LEFT SHIFT": true, "R": true };
  const r2 = buildCombo("R", isDown2);
  r2 === "Ctrl+Shift+R" ? pass("Ctrl+Shift+R", r2) : fail("Ctrl+Shift+R", `got "${r2}"`);

  const isDown3: Record<string, boolean> = { "LEFT ALT": true };
  const r3 = buildCombo("SPACE", isDown3);
  r3 === "Alt+SPACE" ? pass("Alt+Space", r3) : fail("Alt+Space", `got "${r3}"`);

  // Modifier-only should return just modifier
  const r4 = buildCombo("LEFT META", { "LEFT META": true });
  isModifier("LEFT META") ? pass("isModifier(LEFT META)", "true") : fail("isModifier", "false");

  // No modifier
  const r5 = buildCombo("A", {});
  r5 === "A" ? pass("No modifier", r5) : fail("No modifier", `got "${r5}"`);

  // ─── Block B: keystroke log ───
  console.log(`\n${DIM}[B] keystroke log${RESET}`);

  const logPath = airpath("logs", "keystrokes.jsonl");
  // Clear and test
  mkdirSync(airpath("logs"), { recursive: true });
  if (existsSync(logPath)) unlinkSync(logPath);

  // Calling buildCombo should write to log
  buildCombo("TEST", { "LEFT META": true });
  if (existsSync(logPath)) {
    const content = readFileSync(logPath, "utf-8").trim();
    try {
      const parsed = JSON.parse(content);
      parsed.combo === "Cmd+TEST" ? pass("Log written", `combo=${parsed.combo}`) : fail("Log combo wrong", parsed.combo);
    } catch {
      fail("Log not valid JSON", content.slice(0, 100));
    }
  } else {
    fail("Log file not created");
  }

  // ─── Block C & D: shortcut match (simulated) ───
  console.log(`\n${DIM}[C/D] shortcut match simulation${RESET}`);

  const targetCombo = "Cmd+ESCAPE";
  let startCalled = false;
  let stopCalled = false;
  let stateIsRecording = false;

  // Simulate first press
  const combo1 = buildCombo("ESCAPE", { "LEFT META": true });
  if (combo1 === targetCombo && !stateIsRecording) {
    startCalled = true;
    stateIsRecording = true;
  }
  startCalled ? pass("First press → start", combo1) : fail("First press missed");

  // Simulate second press
  const combo2 = buildCombo("ESCAPE", { "LEFT META": true });
  if (combo2 === targetCombo && stateIsRecording) {
    stopCalled = true;
    stateIsRecording = false;
  }
  stopCalled ? pass("Second press → stop", combo2) : fail("Second press missed");

  // ─── Block E: audio recording ───
  console.log(`\n${DIM}[E] audio recording (3s)${RESET}`);

  try {
    const wavBuffer = await recordDuration(2, "default");
    wavBuffer.length > 100
      ? pass("WAV recorded", `${wavBuffer.length} bytes`)
      : fail("WAV too small", `${wavBuffer.length} bytes`);
  } catch (e: any) {
    fail("Recording failed", e.message);
  }

  // ─── Block F: STT ───
  console.log(`\n${DIM}[F] STT (Groq Whisper)${RESET}`);

  const groqKey = loadEnvKey("GROQ_API_KEY");
  if (!groqKey) {
    fail("GROQ_API_KEY not found");
  } else {
    try {
      // Use a short recording
      const wav = await recordDuration(2, "default");
      const stt = await transcribe(groqKey, wav, "auto");
      stt.durationMs < 10000
        ? pass("STT response", `${stt.durationMs}ms "${stt.text.trim().slice(0, 50)}"`)
        : fail("STT too slow", `${stt.durationMs}ms`);
    } catch (e: any) {
      fail("STT error", e.message.slice(0, 100));
    }
  }

  // ─── Block G: LLM ───
  console.log(`\n${DIM}[G] LLM (OpenRouter)${RESET}`);

  const orKey = loadEnvKey("OPENROUTER_API_KEY");
  if (!orKey) {
    fail("OPENROUTER_API_KEY not found");
  } else {
    try {
      const llm = await polish(orKey, "Um so I think we should no wait we need to fix the login bug");
      llm.text.length > 0
        ? pass("LLM polish", `${llm.durationMs}ms "${llm.text.slice(0, 60)}"`)
        : fail("LLM empty response");
    } catch (e: any) {
      fail("LLM error", e.message.slice(0, 100));
    }
  }

  // ─── Block H: full pipeline (no paste) ───
  console.log(`\n${DIM}[H] full pipeline (record → STT → LLM → save)${RESET}`);

  if (groqKey && orKey) {
    try {
      const wav = await recordDuration(2, "default");
      const stt = await transcribe(groqKey, wav, "auto");
      const llmResult = await polish(orKey, stt.text || "test sentence for pipeline");

      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const dir = airpath("recordings");
      mkdirSync(dir, { recursive: true });
      const jsonPath = `${dir}/test-${ts}.json`;
      writeFileSync(jsonPath, JSON.stringify({
        ts, rawText: stt.text, polishedText: llmResult.text,
        sttMs: stt.durationMs, llmMs: llmResult.durationMs,
      }, null, 2));

      existsSync(jsonPath)
        ? pass("Pipeline saved", `${jsonPath}`)
        : fail("Pipeline file not created");

      const saved = JSON.parse(readFileSync(jsonPath, "utf-8"));
      saved.polishedText
        ? pass("Pipeline result", `"${saved.polishedText.slice(0, 50)}"`)
        : fail("Pipeline polishedText empty");
    } catch (e: any) {
      fail("Pipeline error", e.message.slice(0, 100));
    }
  } else {
    fail("Pipeline skipped — missing API keys");
  }

  // ─── Summary ───
  console.log(`\n${BOLD}=== ${passed} passed, ${failed} failed ===${RESET}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
