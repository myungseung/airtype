import { spawn, execSync } from "child_process";
import { appendFileSync, mkdirSync } from "fs";

/** Copy text to clipboard and Cmd+V via osascript. Logs everything for debugging. */
export async function pasteText(text: string, autoEnter = true): Promise<number> {
  const start = Date.now();
  const logPath = "/Users/cheonmyeongseung/airtype/logs/paste.jsonl";
  mkdirSync("/Users/cheonmyeongseung/airtype/logs", { recursive: true });

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
  try {
    const clip = execSync("pbpaste", { timeout: 1000, encoding: "utf-8" });
    clipboardOk = clip.length > 0 && clip.slice(0, 50) === text.slice(0, 50);
  } catch {}

  log({ step: "clipboard", ok: clipboardOk });

  await new Promise((r) => setTimeout(r, 80));

  // Cmd+V via osascript
  let pasteOk = false;
  let pasteError = "";
  try {
    const result = execSync(
      `osascript -e 'tell application "System Events" to keystroke "v" using command down' 2>&1`,
      { timeout: 3000, encoding: "utf-8" }
    );
    pasteOk = true;
    log({ step: "paste", ok: true, focusedApp });
  } catch (e: any) {
    pasteError = e.message?.slice(0, 200) || "unknown";
    log({ step: "paste", ok: false, error: pasteError, focusedApp });

    // Retry once
    await new Promise((r) => setTimeout(r, 200));
    try {
      execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, { timeout: 3000 });
      pasteOk = true;
      log({ step: "paste-retry", ok: true });
    } catch (e2: any) {
      log({ step: "paste-retry", ok: false, error: e2.message?.slice(0, 200) });
    }
  }

  if (!pasteOk) {
    console.error(`  ⚠ Paste failed (app: ${focusedApp}) — text is in clipboard, Cmd+V to paste`);
  }

  // Auto-enter after paste
  if (pasteOk && autoEnter) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      execSync(`osascript -e 'tell application "System Events" to keystroke return'`, { timeout: 2000 });
      log({ step: "auto-enter", ok: true });
    } catch (e: any) {
      log({ step: "auto-enter", ok: false, error: e.message?.slice(0, 100) });
    }
  }

  const elapsed = Date.now() - start;
  log({ step: "done", elapsed, pasteOk, autoEnter });
  return elapsed;
}
