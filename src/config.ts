import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/** Base directory for all airtype data: ~/.airtype/ */
export const AIRTYPE_HOME = join(homedir(), ".airtype");
export const airpath = (...parts: string[]) => join(AIRTYPE_HOME, ...parts);

// Ensure base dir exists on import
mkdirSync(AIRTYPE_HOME, { recursive: true });
mkdirSync(airpath("logs"), { recursive: true });
mkdirSync(airpath("recordings"), { recursive: true });

const CONFIG_PATH = airpath("config.json");
const ENV_PATH = airpath(".env");

export interface AirtypeConfig {
  micDevice: string;
  language: string;
  shortcutDisplay: string;
  shortcutKeys: string[];
  autoEnter: boolean;
  wordCount: number;
  testPassed: boolean;
  onboardingDone: boolean;
}

const defaults: AirtypeConfig = {
  micDevice: "default",
  language: "auto",
  shortcutDisplay: "",
  shortcutKeys: [],
  autoEnter: true,
  wordCount: 0,
  testPassed: false,
  onboardingDone: false,
};

export function loadConfig(): AirtypeConfig {
  if (existsSync(CONFIG_PATH)) {
    try {
      return { ...defaults, ...JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) };
    } catch {
      return { ...defaults };
    }
  }
  return { ...defaults };
}

export function saveConfig(config: AirtypeConfig) {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function loadEnvKey(key: string): string {
  if (existsSync(ENV_PATH)) {
    const lines = readFileSync(ENV_PATH, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || !trimmed) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0 && trimmed.slice(0, eq).trim() === key) {
        return trimmed.slice(eq + 1).trim();
      }
    }
  }
  return process.env[key] || "";
}


export function isReady(config: AirtypeConfig): boolean {
  return !!(
    config.onboardingDone &&
    config.shortcutKeys.length > 0 &&
    config.micDevice && config.micDevice !== "default" &&
    config.testPassed
  );
}

const FREE_WORD_LIMIT = 10000;

/** Add words and save. Returns true if over free limit. */
export function addWords(config: AirtypeConfig, text: string): boolean {
  const words = text.trim().split(/\s+/).length;
  config.wordCount = (config.wordCount || 0) + words;
  saveConfig(config);
  return config.wordCount > FREE_WORD_LIMIT;
}

export function isOverLimit(config: AirtypeConfig): boolean {
  return (config.wordCount || 0) > FREE_WORD_LIMIT;
}
