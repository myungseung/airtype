import { execSync } from "child_process";
import { GlobalKeyboardListener } from "node-global-key-listener";
import { loadEnvKey, saveConfig, type AirtypeConfig } from "./config.js";
import { recordDuration } from "./audio.js";
import { transcribe } from "./stt.js";
import { polish } from "./llm.js";
import inquirer from "inquirer";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

export async function runOnboarding(config: AirtypeConfig) {
  console.log(`
${CYAN}    ╭─────────────────────────────────────╮
    │                                     │
    │  ░█▀█░▀█▀░█▀▄░▀█▀░█░█░█▀█░█▀▀     │
    │  ░█▀█░░█░░█▀▄░░█░░░█░░█▀▀░█▀▀     │
    │  ░▀░▀░▀▀▀░▀░▀░░▀░░░▀░░▀░░░▀▀▀     │
    │                                     │
    │     hands-free transcription         │
    │             v0.2.0                   │
    ╰─────────────────────────────────────╯${RESET}

  Welcome to Airtype. Let's set things up.
`);

  // Step 1: Mic Permission
  console.log(`  ${CYAN}${BOLD}[1/7] Microphone Permission${RESET}`);
  try {
    execSync("rec -q -r 16000 -c 1 /tmp/airtype-test.wav trim 0 0.1", { stdio: "ignore" });
    console.log(`  ${GREEN}${BOLD}✓${RESET} Microphone access granted\n`);
  } catch {
    console.log(`  ${RED}${BOLD}✗${RESET} Microphone access denied. Grant permission in System Settings.\n`);
  }

  // Step 2: Accessibility
  console.log(`  ${CYAN}${BOLD}[2/7] Accessibility Permission${RESET}`);
  console.log(`  ${DIM}Needed to paste text into other apps.${RESET}`);
  console.log(`  ${DIM}Opening System Settings...${RESET}\n`);
  execSync("open 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'");
  console.log(`  ${DIM}Find your terminal app and toggle it ON.${RESET}\n`);
  await prompt("  Press Enter when done... ");
  console.log(`  ${GREEN}${BOLD}✓${RESET} Accessibility configured\n`);

  // Step 3: Mic Selection
  console.log(`  ${CYAN}${BOLD}[3/7] Microphone Selection${RESET}\n`);
  const mics = getMicrophones();
  const { mic } = await inquirer.prompt([{
    type: "list",
    name: "mic",
    message: "Select microphone:",
    choices: mics,
  }]);
  config.micDevice = mic;
  console.log(`  ${GREEN}${BOLD}✓${RESET} ${mic}\n`);

  // Step 4: Shortcut
  console.log(`  ${CYAN}${BOLD}[4/7] Shortcut Key Binding${RESET}`);
  console.log(`  ${DIM}Press your desired shortcut combo from anywhere.${RESET}`);
  console.log(`  ${DIM}Must include a modifier: Ctrl/Alt/Shift/Cmd + key${RESET}\n`);
  console.log(`  ${BOLD}Waiting for keypress...${RESET}`);

  const shortcut = await captureShortcut();
  config.shortcutDisplay = shortcut.display;
  config.shortcutKeys = shortcut.keys;
  console.log(`  ${GREEN}${BOLD}✓${RESET} Shortcut: ${shortcut.display}\n`);

  // Step 5: API Keys
  console.log(`  ${CYAN}${BOLD}[5/7] API Keys${RESET}`);
  const envGroq = loadEnvKey("GROQ_API_KEY");
  const envOr = loadEnvKey("OPENROUTER_API_KEY");
  if (envGroq && envOr) {
    config.groqApiKey = envGroq;
    config.openrouterApiKey = envOr;
    console.log(`  ${DIM}Found in .env${RESET}`);
    console.log(`  ${GREEN}${BOLD}✓${RESET} API keys loaded\n`);
  } else {
    if (!config.groqApiKey) {
      const { key } = await inquirer.prompt([{ type: "input", name: "key", message: "Groq API key (console.groq.com):" }]);
      config.groqApiKey = key;
    }
    if (!config.openrouterApiKey) {
      const { key } = await inquirer.prompt([{ type: "input", name: "key", message: "OpenRouter API key (openrouter.ai):" }]);
      config.openrouterApiKey = key;
    }
    console.log(`  ${GREEN}${BOLD}✓${RESET} API keys saved\n`);
  }

  // Step 6: Language
  console.log(`  ${CYAN}${BOLD}[6/7] Language${RESET}\n`);
  const { lang } = await inquirer.prompt([{
    type: "list",
    name: "lang",
    message: "Transcription language:",
    choices: [
      { name: "Auto-detect (recommended)", value: "auto" },
      { name: "Korean (한국어)", value: "ko" },
      { name: "English", value: "en" },
      { name: "Japanese (日本語)", value: "ja" },
    ],
  }]);
  config.language = lang;

  // Step 7: Guided Test
  console.log(`\n  ${CYAN}${BOLD}[7/7] Guided Test${RESET}`);
  console.log(`  ${DIM}Try 3 recordings with your shortcut key.${RESET}`);
  console.log(`  ${DIM}Read each sentence aloud to see the result.${RESET}\n`);

  const tests = [
    { label: "Hesitation Clearing", sentence: "Um so I think we should... no wait... we need to fix the login bug" },
    { label: "Auto Numbered List", sentence: "First update the API docs second fix the timeout bug third deploy to staging" },
    { label: "Email Format", sentence: "Dear Michael new line I wanted to follow up on our meeting period Best regards Chris" },
  ];

  for (let i = 0; i < tests.length; i++) {
    const { label, sentence } = tests[i]!;

    console.log(`  ${CYAN}╭─ [${i + 1}/3] ${label} ${"─".repeat(Math.max(0, 42 - label.length))}╮${RESET}`);
    console.log(`  ${CYAN}│${RESET}                                                  ${CYAN}│${RESET}`);
    console.log(`  ${CYAN}│${RESET}  ${BOLD}${`Say: "${sentence}"`}${RESET}`);
    console.log(`  ${CYAN}│${RESET}                                                  ${CYAN}│${RESET}`);
    console.log(`  ${CYAN}│${RESET}  Press ${BOLD}${config.shortcutDisplay}${RESET} to start, press again to stop.  ${CYAN}│${RESET}`);
    console.log(`  ${CYAN}│${RESET}                                                  ${CYAN}│${RESET}`);
    console.log(`  ${CYAN}╰${"─".repeat(50)}╯${RESET}\n`);

    // Wait for shortcut press → record → shortcut press → stop → process
    const wavBuffer = await recordWithShortcut(config);

    console.log(`  ${YELLOW}Processing...${RESET}`);
    try {
      const sttResult = await transcribe(config.groqApiKey, wavBuffer, config.language);
      const llmResult = await polish(config.openrouterApiKey, sttResult.text);

      console.log(`  ${DIM}You said:${RESET}  ${sttResult.text.trim()}`);
      console.log(`  ${GREEN}${BOLD}Result:${RESET}    ${BOLD}${llmResult.text}${RESET}`);
      console.log(`  ${DIM}${sttResult.durationMs + llmResult.durationMs}ms${RESET}\n`);
    } catch (e: any) {
      console.log(`  ${RED}Error: ${e.message}${RESET}\n`);
    }
  }

  console.log(`  ${GREEN}${BOLD}✓${RESET} All 3 tests done! You're ready to use Airtype.\n`);

  config.onboardingDone = true;
  saveConfig(config);
}

// ─── Helpers ─────────────────────────────────────

function getMicrophones(): string[] {
  try {
    const output = execSync("system_profiler SPAudioDataType 2>/dev/null", { encoding: "utf-8" });
    const names: string[] = [];
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.endsWith(":") && !trimmed.startsWith("Audio") && !trimmed.startsWith("Devices") && !trimmed.startsWith("Input") && !trimmed.startsWith("Output")) {
        const name = trimmed.replace(/:$/, "").trim();
        if (name && !names.includes(name)) names.push(name);
      }
    }
    if (names.length === 0) names.push("default");
    return names;
  } catch {
    return ["default"];
  }
}

function captureShortcut(): Promise<{ display: string; keys: string[] }> {
  return new Promise((resolve) => {
    const listener = new GlobalKeyboardListener();
    const heldMods = new Set<string>();

    listener.addListener((e) => {
      const name = e.name || "";

      // Track modifier presses
      if (["LEFT META", "RIGHT META", "LEFT CTRL", "RIGHT CTRL", "LEFT ALT", "RIGHT ALT", "LEFT SHIFT", "RIGHT SHIFT"].includes(name)) {
        if (e.state === "DOWN") {
          if (name.includes("META")) heldMods.add("Cmd");
          if (name.includes("CTRL")) heldMods.add("Ctrl");
          if (name.includes("ALT")) heldMods.add("Alt");
          if (name.includes("SHIFT")) heldMods.add("Shift");
        }
        return;
      }

      // Non-modifier key pressed with at least one modifier held
      if (e.state === "DOWN" && heldMods.size > 0) {
        const keys = [...heldMods, name];
        const display = keys.join("+");
        listener.kill();
        resolve({ display, keys });
      }
    });
  });
}

function recordWithShortcut(config: AirtypeConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const listener = new GlobalKeyboardListener();
    let recording = false;
    let recProc: any = null;
    const heldMods = new Set<string>();
    const target = config.shortcutDisplay;

    listener.addListener((e) => {
      const name = e.name || "";

      // Track modifiers
      if (["LEFT META", "RIGHT META", "LEFT CTRL", "RIGHT CTRL", "LEFT ALT", "RIGHT ALT", "LEFT SHIFT", "RIGHT SHIFT"].includes(name)) {
        if (e.state === "DOWN") {
          if (name.includes("META")) heldMods.add("Cmd");
          if (name.includes("CTRL")) heldMods.add("Ctrl");
          if (name.includes("ALT")) heldMods.add("Alt");
          if (name.includes("SHIFT")) heldMods.add("Shift");
        } else {
          if (name.includes("META")) heldMods.delete("Cmd");
          if (name.includes("CTRL")) heldMods.delete("Ctrl");
          if (name.includes("ALT")) heldMods.delete("Alt");
          if (name.includes("SHIFT")) heldMods.delete("Shift");
        }
        return;
      }

      if (e.state !== "DOWN") return;

      const pressed = [...heldMods, name].join("+");
      if (pressed !== target) return;

      if (!recording) {
        // Start
        recording = true;
        playSound("Glass");
        console.log(`  ${RED}${BOLD}🎙 Recording...${RESET}`);

        const { spawn } = require("child_process");
        const tmpFile = `/tmp/airtype-onboard-${Date.now()}.wav`;
        recProc = { proc: spawn("rec", ["-q", "-r", "16000", "-c", "1", "-b", "16", tmpFile], { stdio: "pipe" }), file: tmpFile };
      } else {
        // Stop
        playSound("Pop");
        listener.kill();

        const { proc, file } = recProc;
        proc.on("close", async () => {
          try {
            const buf = Buffer.from(await Bun.file(file).arrayBuffer());
            resolve(buf);
          } catch (err) {
            reject(err);
          }
        });
        proc.kill("SIGTERM");
      }
    });
  });
}

function playSound(name: string) {
  try { execSync(`afplay /System/Library/Sounds/${name}.aiff &`, { stdio: "ignore" }); } catch {}
}

function prompt(msg: string): Promise<void> {
  return new Promise((resolve) => {
    process.stdout.write(msg);
    process.stdin.once("data", () => resolve());
  });
}
