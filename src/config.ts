import { readFileSync, writeFileSync, existsSync } from "fs";

const CONFIG_PATH = "/Users/cheonmyeongseung/airtype/config.json";
const ENV_PATH = "/Users/cheonmyeongseung/airtype/.env";

export interface AirtypeConfig {
  groqApiKey: string;
  openrouterApiKey: string;
  micDevice: string;
  language: string;
  shortcutDisplay: string;
  shortcutKeys: string[]; // e.g. ["Meta", "Escape"]
  autoEnter: boolean;
  onboardingDone: boolean;
}

const defaults: AirtypeConfig = {
  groqApiKey: "",
  openrouterApiKey: "",
  micDevice: "default",
  language: "auto",
  shortcutDisplay: "",
  shortcutKeys: [],
  autoEnter: true,
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
  return config.onboardingDone && !!config.groqApiKey && !!config.openrouterApiKey && config.shortcutKeys.length > 0;
}
