import { spawn, execSync } from "child_process";
import { appendFileSync } from "fs";
import { airpath } from "./config.js";

/**
 * Pause/resume hook — set by Daemon to suspend the global key listener
 * while osascript injects synthetic keystrokes (Cmd+V / Return).
 * Without this, CGEventTap can race with the synthetic events and
 * the OS may coalesce physical+synthetic modifiers → wrong combo
 * (e.g. Cmd+Ctrl+F instead of Cmd+V).
 */
let _pauseKeyListener: (() => void) | null = null;
let _resumeKeyListener: (() => void) | null = null;

export function setPasteKeyListenerHooks(pause: () => void, resume: () => void) {
  _pauseKeyListener = pause;
  _resumeKeyListener = resume;
}

/** Type a short status hint into the focused app. Returns char count for later erasure. */
export function typeStatus(label: string): number {
  try {
    execSync(`osascript -e 'tell application "System Events" to keystroke ${JSON.stringify(label)}'`, { timeout: 1500 });
  } catch {}
  return label.length;
}

/** Erase `n` characters by sending Backspace n times. */
export function eraseChars(n: number): void {
  if (n <= 0) return;
  try {
    execSync(`osascript -e 'tell application "System Events" to repeat ${n} times' -e 'key code 51' -e 'end repeat'`, { timeout: 2000 });
  } catch {}
}

/** Copy text to clipboard and Cmd+V via osascript. Logs everything for debugging. */
export async function pasteText(text: string, autoEnter = true): Promise<number> {
  const start = Date.now();
  const logPath = airpath("logs", "paste.jsonl");

  const log = (data: Record<string, any>) => {
    appendFileSync(logPath, JSON.stringify({ ts: new Date().toISOString(), ...data }) + "\n");
  };

  // What app is focused right now?
  let focusedApp = "unknown";
  try {
    focusedApp = execSync(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
      { timeout: 2000, encoding: "utf-8" }
    ).trim();
  } catch {}

  log({ step: "start", focusedApp, textLen: text.length });

  // Set clipboard via pbcopy
  const pbcopy = spawn("pbcopy", [], { stdio: ["pipe", "pipe", "pipe"] });
  pbcopy.stdin.write(text);
  pbcopy.stdin.end();
  await new Promise<void>((resolve) => pbcopy.on("close", () => resolve()));

  // Verify clipboard was set
  let clipboardOk = false;
  let clipPreview = "";
  try {
    const clip = execSync("pbpaste", { timeout: 1000, encoding: "utf-8" });
    clipPreview = clip.slice(0, 80);
    clipboardOk = clip.length > 0 && clip.slice(0, 50) === text.slice(0, 50);
  } catch {}

  log({ step: "clipboard", ok: clipboardOk, clipPreview });

  // ── Pause global key listener before injecting synthetic keystrokes ──
  // This prevents CGEventTap from seeing osascript's Cmd+V as a real
  // keypress, which can race with physical modifier state and produce
  // ghost combos like Cmd+Ctrl+F.
  if (_pauseKeyListener) {
    try { _pauseKeyListener(); } catch {}
    log({ step: "key-listener-paused" });
  }

  // Wait for any residual modifier keys to settle
  await new Promise((r) => setTimeout(r, 150));

  // Cmd+V via osascript — use key code 9 (V) for reliability
  let pasteOk = false;
  let pasteError = "";
  try {
    execSync(
      `osascript -e 'tell application "System Events" to key code 9 using command down' 2>&1`,
      { timeout: 3000, encoding: "utf-8" }
    );
    pasteOk = true;
    log({ step: "paste", ok: true, focusedApp, method: "key-code-9" });
  } catch (e: any) {
    pasteError = e.message?.slice(0, 200) || "unknown";
    log({ step: "paste", ok: false, error: pasteError, focusedApp, method: "key-code-9" });

    // Retry with keystroke fallback
    await new Promise((r) => setTimeout(r, 200));
    try {
      execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, { timeout: 3000 });
      pasteOk = true;
      log({ step: "paste-retry", ok: true, method: "keystroke-v" });
    } catch (e2: any) {
      log({ step: "paste-retry", ok: false, error: e2.message?.slice(0, 200) });
    }
  }

  if (!pasteOk) {
    console.error(`  ⚠ Paste failed (app: ${focusedApp}) — text is in clipboard, Cmd+V to paste`);
    try {
      const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;
      execSync(`osascript -e 'display dialog "Cmd+V to paste:" & return & return & ${JSON.stringify(JSON.stringify(preview))} with title "Airtype" buttons {"OK"} default button "OK" giving up after 5'`, { timeout: 6000 });
    } catch {}
  }

  // Auto-enter after paste
  if (pasteOk && autoEnter) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      execSync(`osascript -e 'tell application "System Events" to key code 36'`, { timeout: 2000 }); // key code 36 = Return
      log({ step: "auto-enter", ok: true });
    } catch (e: any) {
      log({ step: "auto-enter", ok: false, error: e.message?.slice(0, 100) });
    }
  }

  // ── Resume global key listener ──
  if (_resumeKeyListener) {
    await new Promise((r) => setTimeout(r, 50));
    try { _resumeKeyListener(); } catch {}
    log({ step: "key-listener-resumed" });
  }

  const elapsed = Date.now() - start;
  log({ step: "done", elapsed, pasteOk, autoEnter });
  return elapsed;
}
