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

export type SystemLang = "ko" | "en";

export const INPUT_LANGS = ["auto", "ko", "en", "ja", "zh", "es", "fr", "de"] as const;
export const OUTPUT_LANGS = ["en", "ko", "ja", "zh", "es", "fr", "de"] as const;

export const LANG_LABELS: Record<string, Record<SystemLang, string>> = {
  auto: { ko: "자동 감지", en: "Auto detect" },
  ko: { ko: "한국어", en: "Korean" },
  en: { ko: "영어", en: "English" },
  ja: { ko: "일본어", en: "Japanese" },
  zh: { ko: "중국어", en: "Chinese" },
  es: { ko: "스페인어", en: "Spanish" },
  fr: { ko: "프랑스어", en: "French" },
  de: { ko: "독일어", en: "German" },
};

export interface AirtypeConfig {
  micDevice: string;
  language: string;
  shortcutDisplay: string;
  shortcutKeys: string[];
  autoEnter: boolean;
  wordCount: number;
  testPassed: boolean;
  onboardingDone: boolean;
  systemLang: SystemLang;
  inputLang: string;
  outputLang: string;
  weeklyWordCount: number;
  weekStartDate: string;
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
  systemLang: "ko",
  inputLang: "auto",
  outputLang: "en",
  weeklyWordCount: 0,
  weekStartDate: getMonday(new Date()),
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
    config.shortcutKeys.length > 0 &&
    config.micDevice && config.micDevice !== "default" &&
    config.onboardingDone
  );
}

const FREE_WEEKLY_LIMIT = 10000;

/** Get Monday of the week for a given date (ISO week, YYYY-MM-DD) */
function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

/** Reset weekly count if we're in a new week */
function ensureWeeklyReset(config: AirtypeConfig): void {
  const currentMonday = getMonday(new Date());
  if (!config.weekStartDate || config.weekStartDate < currentMonday) {
    config.weeklyWordCount = 0;
    config.weekStartDate = currentMonday;
  }
}

/** Add words and save. Returns true if over free limit. */
export function addWords(config: AirtypeConfig, text: string): boolean {
  const words = text.trim().split(/\s+/).length;
  config.wordCount = (config.wordCount || 0) + words;
  ensureWeeklyReset(config);
  config.weeklyWordCount = (config.weeklyWordCount || 0) + words;
  saveConfig(config);
  return config.weeklyWordCount > FREE_WEEKLY_LIMIT;
}

export function isOverLimit(config: AirtypeConfig): boolean {
  ensureWeeklyReset(config);
  return (config.weeklyWordCount || 0) >= FREE_WEEKLY_LIMIT;
}

export function getWeeklyRemaining(config: AirtypeConfig): number {
  ensureWeeklyReset(config);
  return Math.max(0, FREE_WEEKLY_LIMIT - (config.weeklyWordCount || 0));
}
