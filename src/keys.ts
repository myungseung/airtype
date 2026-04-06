import type { IGlobalKeyDownMap } from "node-global-key-listener";

/**
 * Build a shortcut display string from the current isDown map + pressed key name.
 * Uses the isDown map provided by node-global-key-listener (second callback arg).
 * This is the authoritative modifier state — no manual tracking needed.
 */
export function buildCombo(keyName: string, isDown: IGlobalKeyDownMap): string {
  const parts: string[] = [];

  if (isDown["LEFT META"] || isDown["RIGHT META"]) parts.push("Cmd");
  if (isDown["LEFT CTRL"] || isDown["RIGHT CTRL"]) parts.push("Ctrl");
  if (isDown["LEFT ALT"] || isDown["RIGHT ALT"]) parts.push("Alt");
  if (isDown["LEFT SHIFT"] || isDown["RIGHT SHIFT"]) parts.push("Shift");

  // Don't add modifier names as the key itself
  if (!isModifier(keyName)) {
    parts.push(keyName);
  }

  const result = parts.join("+");

  // Raw log every key event for debugging
  const fs = require("fs");
  const { airpath } = require("./config.js");
  const ts = new Date().toISOString();
  const logLine = JSON.stringify({ ts, keyName, combo: result, isDown: Object.fromEntries(Object.entries(isDown).filter(([_, v]) => v)) }) + "\n";
  try { fs.appendFileSync(airpath("logs", "keystrokes.jsonl"), logLine); } catch {}

  return result;
}

/** Debounce shortcut — returns true if this is a duplicate within 200ms */
let lastCombo = "";
let lastTime = 0;

export function isDuplicate(combo: string): boolean {
  const now = Date.now();
  if (combo === lastCombo && now - lastTime < 200) {
    return true;
  }
  lastCombo = combo;
  lastTime = now;
  return false;
}

export function isModifier(name: string): boolean {
  return [
    "LEFT META", "RIGHT META",
    "LEFT CTRL", "RIGHT CTRL",
    "LEFT ALT", "RIGHT ALT",
    "LEFT SHIFT", "RIGHT SHIFT",
  ].includes(name);
}
