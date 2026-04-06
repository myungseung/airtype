import { readFileSync, existsSync, readdirSync } from "fs";
import { airpath } from "./config.js";
import { loadEnvKey } from "./config.js";

function getWebhook(): string {
  return loadEnvKey("SLACK_WEBHOOK_URL") || process.env.SLACK_WEBHOOK_URL || "";
}

/** Send error report to Slack automatically */
export async function reportError(context: string, error: string, extra?: Record<string, any>) {
  try {
    const hostname = require("os").hostname();
    const payload = {
      text: `🔴 *Airtype Error*\n*Context:* ${context}\n*Error:* \`${error.slice(0, 500)}\`\n*Host:* ${hostname}\n*Time:* ${new Date().toISOString()}${extra ? `\n*Extra:* \`\`\`${JSON.stringify(extra, null, 2).slice(0, 500)}\`\`\`` : ""}`,
    };
    const wh = getWebhook(); if (!wh) return;
    await fetch(wh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silent fail — don't crash on report failure
  }
}

/** Send startup + config summary */
export async function reportStartup(config: Record<string, any>) {
  try {
    const hostname = require("os").hostname();
    const payload = {
      text: `🟢 *Airtype Started*\n*Host:* ${hostname}\n*Shortcut:* ${config.shortcutDisplay}\n*Mic:* ${config.micDevice}\n*Auto-Enter:* ${config.autoEnter ? "ON" : "OFF"}\n*Time:* ${new Date().toISOString()}`,
    };
    const wh = getWebhook(); if (!wh) return;
    await fetch(wh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

/** Collect recent logs and send summary */
export async function reportLogs() {
  try {
    const logsDir = airpath("logs");
    const parts: string[] = [];

    // Paste logs
    const pastePath = `${logsDir}/paste.jsonl`;
    if (existsSync(pastePath)) {
      const lines = readFileSync(pastePath, "utf-8").trim().split("\n").slice(-5);
      parts.push("*Recent paste logs:*\n```\n" + lines.join("\n") + "\n```");
    }

    // Keystroke logs (last 10)
    const keysPath = `${logsDir}/keystrokes.jsonl`;
    if (existsSync(keysPath)) {
      const lines = readFileSync(keysPath, "utf-8").trim().split("\n").slice(-10);
      parts.push("*Recent keystrokes:*\n```\n" + lines.join("\n") + "\n```");
    }

    // Recent recordings
    const recDir = airpath("recordings");
    if (existsSync(recDir)) {
      const jsons = readdirSync(recDir).filter(f => f.endsWith(".json")).sort().slice(-3);
      for (const f of jsons) {
        const content = readFileSync(`${recDir}/${f}`, "utf-8").slice(0, 300);
        parts.push(`*${f}:*\n\`\`\`\n${content}\n\`\`\``);
      }
    }

    const hostname = require("os").hostname();
    const wh = getWebhook(); if (!wh) return;
    await fetch(wh, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `📋 *Airtype Log Report*\n*Host:* ${hostname}\n*Time:* ${new Date().toISOString()}\n\n${parts.join("\n\n")}`,
      }),
    });
    console.log("  Report sent to Slack.");
  } catch (e: any) {
    console.error("  Report failed:", e.message);
  }
}
