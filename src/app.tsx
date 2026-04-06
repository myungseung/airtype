import React, { useState, useEffect, useRef } from "react";
import { render, Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { loadConfig, saveConfig, loadEnvKey, isReady, type AirtypeConfig } from "./config.js";
import { GlobalKeyboardListener } from "node-global-key-listener";
import { buildCombo, isModifier, isDuplicate } from "./keys.js";
import { startRecording } from "./audio.js";
import { transcribe } from "./stt.js";
import { polish } from "./llm.js";
import { pasteText } from "./paste.js";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { reportError, reportStartup, reportLogs } from "./report.js";

// ─── Logo (bigger, clearer) ─────────────────────────
const LOGO = [
  "",
  "     █████╗ ██╗██████╗ ████████╗██╗   ██╗██████╗ ███████╗",
  "    ██╔══██╗██║██╔══██╗╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔════╝",
  "    ███████║██║██████╔╝   ██║    ╚████╔╝ ██████╔╝█████╗  ",
  "    ██╔══██║██║██╔══██╗   ██║     ╚██╔╝  ██╔═══╝ ██╔══╝  ",
  "    ██║  ██║██║██║  ██║   ██║      ██║   ██║     ███████╗",
  "    ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝     ╚══════╝",
  "",
  "              hands-free transcription v0.2",
  "",
];

const LogoBox = () => (
  <Box flexDirection="column">
    {LOGO.map((l, i) => <Text key={i} color="cyan">{l}</Text>)}
  </Box>
);

const LogoSmall = () => (
  <Box flexDirection="column" paddingLeft={2}>
    <Text color="cyan">  ╭─ AIRTYPE ─────────────────────────╮</Text>
    <Text color="cyan">  │   hands-free transcription v0.2    │</Text>
    <Text color="cyan">  ╰────────────────────────────────────╯</Text>
  </Box>
);

// ─── Speech Bar ──────────────────────────────────────
const SpeechBar = ({ level }: { level: number }) => {
  const width = 20;
  const filled = Math.round(level * width);
  return <Text color="cyan">[{"█".repeat(filled)}{"░".repeat(width - filled)}]</Text>;
};

// ─── Status Line (shared by onboarding + daemon) ─────
type RecPhase = "wait" | "rec" | "proc" | "done";

const StatusLine = ({ phase, shortcut, result, volume }: {
  phase: RecPhase;
  shortcut: string;
  result: { raw: string; pol: string } | null;
  volume: number;
}) => (
  <Box flexDirection="column" marginTop={1} paddingLeft={2}>
    {phase === "wait" && <Text dimColor>{shortcut} 으로 시작</Text>}
    {phase === "rec" && (
      <Box>
        <Text color="red" bold><Spinner type="dots" /> 녹음 중  </Text>
        <SpeechBar level={volume} />
      </Box>
    )}
    {phase === "proc" && <Text color="yellow"><Spinner type="dots" /> 처리 중...</Text>}
    {phase === "done" && result && (
      <>
        <Text dimColor>You said:  {result.raw.trim()}</Text>
        <Text bold color="green">Result:    {result.pol}</Text>
        <Box marginTop={1}><Text dimColor>Enter — 다음</Text></Box>
      </>
    )}
  </Box>
);

// ─── Key Capture Help (shows after 5s if no input) ───
const KeyCaptureHint = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (elapsed < 5) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="yellow" bold>키 입력이 감지되지 않나요?</Text>
      <Text dimColor>시스템 설정 → 개인정보 보호 및 보안 → 입력 모니터링</Text>
      <Text dimColor>에서 이 터미널 앱을 허용해주세요.</Text>
      {elapsed >= 10 && (
        <Box marginTop={1}>
          <Text dimColor>그래도 안 되면 Ctrl+C 후 터미널을 재시작하고 다시 실행하세요.</Text>
        </Box>
      )}
    </Box>
  );
};

// ─── Onboarding ──────────────────────────────────────
const TOTAL_STEPS = 6;

const GUIDES = [
  { intro: "말을 더듬어도, Airtype이 깔끔하게 정리해줘요.", sentence: "Um so I think... no wait... we need to fix the login bug" },
  { intro: "나열하면 자동으로 번호를 매겨줘요.", sentence: "First update docs second fix the bug third deploy" },
  { intro: "이메일도 말로 쓸 수 있어요.", sentence: "Dear Michael new line follow up period Regards Chris" },
];

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 7 = congrats

const Onboarding = ({ config, onDone }: { config: AirtypeConfig; onDone: (c: AirtypeConfig) => void }) => {
  const [stepId, setStepId] = useState<StepId>(1);
  const [cfg, setCfg] = useState({ ...config, groqApiKey: loadEnvKey("GROQ_API_KEY"), openrouterApiKey: loadEnvKey("OPENROUTER_API_KEY") });
  const [capturedCombo, setCapturedCombo] = useState("");
  const [phase, setPhase] = useState<RecPhase>("wait");
  const [result, setResult] = useState<{ raw: string; pol: string } | null>(null);
  const [volume, setVolume] = useState(0);

  const stepRef = useRef(stepId);
  stepRef.current = stepId;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const recRef = useRef<ReturnType<typeof startRecording> | null>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  // ── Global key listener ──
  useEffect(() => {
    const listener = new GlobalKeyboardListener();

    listener.addListener((e, isDown) => {
      if (e.state !== "DOWN") return;
      const name = e.name || "";
      if (isModifier(name)) return;
      const combo = buildCombo(name, isDown);

      const s = stepRef.current;
      const p = phaseRef.current;

      // Step 1: shortcut capture
      if (s === 1 && combo.includes("+")) {
        setCapturedCombo(combo);
      }

      // Steps 3-6: recording toggle
      if (s >= 3 && s <= 6 && combo === cfgRef.current.shortcutDisplay && !isDuplicate(combo)) {
        if (p === "wait") {
          playSound("Glass");
          phaseRef.current = "rec";
          setPhase("rec");
          setVolume(0);
          const rec = startRecording(cfgRef.current.micDevice);
          rec.onVolume((v) => setVolume(v));
          recRef.current = rec;
        } else if (p === "rec" && recRef.current) {
          playSound("Pop");
          phaseRef.current = "proc";
          setPhase("proc");
          const r = recRef.current;
          recRef.current = null;
          r.stop().then(async (wav) => {
            try {
              const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const dir = "/Users/cheonmyeongseung/airtype/recordings";
              mkdirSync(dir, { recursive: true });
              writeFileSync(`${dir}/onboard-${ts}.wav`, wav);

              const stt = await transcribe(cfgRef.current.groqApiKey, wav, "auto");
              const llm = await polish(cfgRef.current.openrouterApiKey, stt.text);
              setResult({ raw: stt.text, pol: llm.text });

              writeFileSync(`${dir}/onboard-${ts}.json`, JSON.stringify({
                ts, step: stepRef.current, rawText: stt.text, polishedText: llm.text,
                sttMs: stt.durationMs, llmMs: llm.durationMs,
              }, null, 2));
            } catch (err: any) {
              setResult({ raw: "(error)", pol: err.message });
            }
            phaseRef.current = "done";
            setPhase("done");
          });
        }
      }
    });

    return () => listener.kill();
  }, []);

  // ── Enter key ──
  useInput((_, key) => {
    if (!key.return) return;
    const s = stepRef.current;
    const p = phaseRef.current;

    if (s === 1 && capturedCombo) {
      const updated = { ...cfgRef.current, shortcutDisplay: capturedCombo, shortcutKeys: capturedCombo.split("+") };
      cfgRef.current = updated;
      setCfg(updated);
      stepRef.current = 2;
      setStepId(2);
    }

    if (p === "done") {
      setResult(null);
      phaseRef.current = "wait";
      setPhase("wait");
      setVolume(0);
      if (s < 6) {
        stepRef.current = (s + 1) as StepId;
        setStepId((s + 1) as StepId);
      } else {
        // Save and show congrats
        const final = { ...cfgRef.current, onboardingDone: true };
        saveConfig(final);
        stepRef.current = 7;
        setStepId(7);
      }
    }

    // Congrats → daemon
    if (s === 7) {
      onDone(cfgRef.current);
    }
  });

  return (
    <Box flexDirection="column">
      {stepId !== 7 && (
        <>
          <LogoBox />
          <Box paddingLeft={2}><Text dimColor>[{Math.min(stepId, TOTAL_STEPS)}/{TOTAL_STEPS}]</Text></Box>
        </>
      )}

      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        {/* Step 1: Shortcut */}
        {stepId === 1 && !capturedCombo && (
          <>
            <Text bold>단축키를 정해주세요.</Text>
            <Text dimColor>원하는 키 조합을 눌러보세요.</Text>
            <Text dimColor>(예: Cmd+Esc, Ctrl+Shift+R, Alt+Space)</Text>
            <Box marginTop={1}><Text dimColor>기다리는 중...</Text></Box>
            <KeyCaptureHint />
          </>
        )}
        {stepId === 1 && capturedCombo && (
          <>
            <Box marginBottom={1}><Text bold color="cyan">{capturedCombo}</Text></Box>
            <Text>이 키로 할까요?</Text>
            <Text dimColor>Enter — 확정  |  다른 키 — 변경</Text>
          </>
        )}

        {/* Step 2: Mic */}
        {stepId === 2 && (
          <>
            <Text bold>어떤 마이크를 사용할까요?</Text>
            <Box marginTop={1}>
              <SelectInput
                items={getMics().map(m => ({ label: m, value: m }))}
                onSelect={item => {
                  setCfg(prev => ({ ...prev, micDevice: item.value }));
                  cfgRef.current = { ...cfgRef.current, micDevice: item.value };
                  stepRef.current = 3;
                  setStepId(3);
                }}
              />
            </Box>
          </>
        )}

        {/* Step 3: Free test */}
        {stepId === 3 && (
          <>
            <Text bold>테스트해볼게요.</Text>
            <Text dimColor>아무 말이나 해보세요.</Text>
            <StatusLine phase={phase} shortcut={cfg.shortcutDisplay} result={result} volume={volume} />
          </>
        )}

        {/* Steps 4-6: Guided tests */}
        {stepId >= 4 && stepId <= 6 && (
          <>
            <Text>{GUIDES[stepId - 4]!.intro}</Text>
            <Box marginTop={1}>
              <Text bold color="white">"{GUIDES[stepId - 4]!.sentence}"</Text>
            </Box>
            <StatusLine phase={phase} shortcut={cfg.shortcutDisplay} result={result} volume={volume} />
          </>
        )}

        {/* Step 7: Congrats */}
        {stepId === 7 && (
          <>
            <LogoBox />
            <Box flexDirection="column" paddingLeft={2}>
              <Text bold color="green">✓ 설정 완료!</Text>
              <Text> </Text>
              <Text>이제 아무 앱에서 <Text bold color="cyan">{cfg.shortcutDisplay}</Text> 을 누르면</Text>
              <Text>녹음이 시작됩니다. 소리로 알려드릴게요.</Text>
              <Text> </Text>
              <Text dimColor>단축키: {cfg.shortcutDisplay}</Text>
              <Text dimColor>마이크: {cfg.micDevice}</Text>
              <Text> </Text>
              <Text dimColor>설정을 다시 하려면: bun run src/app.tsx --setup</Text>
              <Text> </Text>
              <Text dimColor>Enter — 시작</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

// ─── Daemon ──────────────────────────────────────────
type DState = "ready" | "rec" | "proc";

const Daemon = ({ config, autoEnter, onToggleAutoEnter, onOpenSettings }: { config: AirtypeConfig; autoEnter: boolean; onToggleAutoEnter: () => void; onOpenSettings: () => void }) => {
  const [state, setState] = useState<DState>("ready");
  const [last, setLast] = useState<{ raw: string; pol: string; stt: number; llm: number; paste: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vol, setVol] = useState(0);
  const sRef = useRef<DState>("ready");
  const rRef = useRef<ReturnType<typeof startRecording> | null>(null);
  const autoEnterRef = useRef(autoEnter);
  autoEnterRef.current = autoEnter;

  useInput((input) => {
    if (input === "e" || input === "E") onToggleAutoEnter();
    if (input === "s" || input === "S") onOpenSettings();
  });

  useEffect(() => {
    const listener = new GlobalKeyboardListener();
    listener.addListener((e, isDown) => {
      if (e.state !== "DOWN") return;
      const name = e.name || "";
      if (isModifier(name)) return;
      const combo = buildCombo(name, isDown);
      if (combo !== config.shortcutDisplay || isDuplicate(combo)) return;

      if (sRef.current === "rec" && rRef.current) {
        playSound("Pop");
        sRef.current = "proc"; setState("proc");
        const rec = rRef.current; rRef.current = null;
        rec.stop().then(async (wav) => {
          try {
            const t0 = Date.now();
            const stt = await transcribe(config.groqApiKey, wav, config.language);
            if (!stt.text.trim()) { sRef.current = "ready"; setState("ready"); return; }
            const llm = await polish(config.openrouterApiKey, stt.text);
            const paste = await pasteText(llm.text, autoEnterRef.current);
            const total = Date.now() - t0;
            const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const dir = "/Users/cheonmyeongseung/airtype/recordings";
            mkdirSync(dir, { recursive: true });
            writeFileSync(`${dir}/${ts}.wav`, wav);
            writeFileSync(`${dir}/${ts}.json`, JSON.stringify({ ts, rawText: stt.text, polishedText: llm.text, sttMs: stt.durationMs, llmMs: llm.durationMs, pasteMs: paste, totalMs: total }, null, 2));
            setLast({ raw: stt.text, pol: llm.text, stt: stt.durationMs, llm: llm.durationMs, paste, total });
            setError(null);
          } catch (e: any) { setError(e.message); reportError("daemon-pipeline", e.message); }
          sRef.current = "ready"; setState("ready");
        });
      } else if (sRef.current === "ready") {
        playSound("Glass");
        const rec = startRecording(config.micDevice);
        rec.onVolume((v) => setVol(v));
        rRef.current = rec;
        sRef.current = "rec"; setState("rec");
        setVol(0); setLast(null); setError(null);
      }
    });
    return () => listener.kill();
  }, []);

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {state === "ready" && <Text color="green" bold>● Ready</Text>}
      {state === "rec" && (
        <Box>
          <Text color="red" bold><Spinner type="dots" /> Recording  </Text>
          <SpeechBar level={vol} />
        </Box>
      )}
      {state === "proc" && <Text color="yellow"><Spinner type="dots" /> Processing...</Text>}
      {last && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>STT {last.stt}ms  {trunc(last.raw, 60)}</Text>
          <Text dimColor>Total {last.total}ms  (paste {last.paste}ms)</Text>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>── Result ──────────────────────────────</Text>
            <Text bold wrap="wrap">{last.pol}</Text>
            <Text dimColor>────────────────────────────────────────</Text>
          </Box>
        </Box>
      )}
      {error && <Text color="red">ERROR: {error}</Text>}
    </Box>
  );
};

// ─── Settings ────────────────────────────────────────
type SettingItem = "shortcut" | "mic" | "auto-enter" | "back";
type SettingSub = null | "shortcut-capture" | "mic-select";

const Settings = ({ config, onSave }: { config: AirtypeConfig; onSave: (c: AirtypeConfig) => void }) => {
  const [sub, setSub] = useState<SettingSub>(null);
  const [cfg, setCfg] = useState({ ...config });
  const [capturedCombo, setCapturedCombo] = useState("");
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  // Shortcut capture listener
  useEffect(() => {
    if (sub !== "shortcut-capture") return;
    const listener = new GlobalKeyboardListener();
    listener.addListener((e, isDown) => {
      if (e.state !== "DOWN") return;
      const name = e.name || "";
      if (isModifier(name)) return;
      const combo = buildCombo(name, isDown);
      if (!combo.includes("+")) return;
      setCapturedCombo(combo);
    });
    return () => listener.kill();
  }, [sub]);

  useInput((input, key) => {
    if (sub === "shortcut-capture" && key.return && capturedCombo) {
      const updated = { ...cfgRef.current, shortcutDisplay: capturedCombo, shortcutKeys: capturedCombo.split("+") };
      saveConfig(updated);
      setCfg(updated);
      setSub(null);
      setCapturedCombo("");
    }
    if (sub === "shortcut-capture" && key.escape) {
      setSub(null);
      setCapturedCombo("");
    }
  });

  // Main menu
  if (!sub) {
    const items = [
      { label: `Shortcut     ${cfg.shortcutDisplay}`, value: "shortcut" as SettingItem },
      { label: `Microphone   ${cfg.micDevice}`, value: "mic" as SettingItem },
      { label: `Auto-Enter   ${cfg.autoEnter ? "ON" : "OFF"}`, value: "auto-enter" as SettingItem },
      { label: "← Back", value: "back" as SettingItem },
    ];

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Settings</Text>
        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={(item) => {
              if (item.value === "back") { onSave(cfg); return; }
              if (item.value === "shortcut") { setSub("shortcut-capture"); return; }
              if (item.value === "mic") { setSub("mic-select"); return; }
              if (item.value === "auto-enter") {
                const updated = { ...cfgRef.current, autoEnter: !cfgRef.current.autoEnter };
                saveConfig(updated);
                setCfg(updated);
              }
            }}
          />
        </Box>
      </Box>
    );
  }

  // Sub: shortcut capture
  if (sub === "shortcut-capture") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Shortcut</Text>
        <Box marginTop={1}><Text dimColor>원하는 키 조합을 눌러보세요.</Text></Box>
        {capturedCombo ? (
          <>
            <Box marginTop={1}><Text bold color="cyan">{capturedCombo}</Text></Box>
            <Text dimColor>Enter — 확정  |  다른 키 — 변경  |  Esc — 취소</Text>
          </>
        ) : (
          <Box marginTop={1}><Text dimColor>기다리는 중...</Text></Box>
        )}
      </Box>
    );
  }

  // Sub: mic select
  if (sub === "mic-select") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">Microphone</Text>
        <Box marginTop={1}>
          <SelectInput
            items={getMics().map(m => ({ label: m, value: m }))}
            onSelect={(item) => {
              const updated = { ...cfgRef.current, micDevice: item.value };
              saveConfig(updated);
              setCfg(updated);
              setSub(null);
            }}
          />
        </Box>
      </Box>
    );
  }

  return null;
};

// ─── App ─────────────────────────────────────────────
const StatusBox = ({ config, autoEnter }: { config: AirtypeConfig; autoEnter: boolean }) => (
  <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
    <Text><Text dimColor>Shortcut  </Text>  <Text bold>{config.shortcutDisplay}</Text></Text>
    <Text><Text dimColor>Mic       </Text>  {config.micDevice}</Text>
    <Text><Text dimColor>Auto-Enter</Text>  {autoEnter ? <Text color="green">ON</Text> : <Text dimColor>OFF</Text>}</Text>
    <Box marginTop={1}><Text dimColor>S settings  |  E auto-enter  |  Ctrl+C quit</Text></Box>
  </Box>
);

const App = () => {
  const [config, setConfig] = useState<AirtypeConfig | null>(null);
  const [mode, setMode] = useState<"load" | "onboard" | "daemon" | "settings">("load");
  const [autoEnter, setAutoEnter] = useState(true);

  useEffect(() => {
    const c = loadConfig();
    setConfig(c);
    setAutoEnter(c.autoEnter ?? true);
    setMode(!isReady(c) || process.argv.includes("--setup") ? "onboard" : "daemon");
  }, []);

  const toggleAutoEnter = () => {
    setAutoEnter(prev => {
      const next = !prev;
      if (config) { saveConfig({ ...config, autoEnter: next }); }
      return next;
    });
  };

  if (!config) return <Text>Loading...</Text>;
  if (mode === "onboard") return <Onboarding config={config} onDone={c => { setConfig(c); setAutoEnter(c.autoEnter ?? true); setMode("daemon"); }} />;

  if (mode === "settings") {
    return (
      <Box flexDirection="column">
        <LogoSmall />
        <Settings config={config} onSave={(c) => { setConfig(c); setAutoEnter(c.autoEnter ?? true); setMode("daemon"); }} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <LogoSmall />
      <StatusBox config={config} autoEnter={autoEnter} />
      <Daemon config={config} autoEnter={autoEnter} onToggleAutoEnter={toggleAutoEnter} onOpenSettings={() => setMode("settings")} />
    </Box>
  );
};

// ─── Helpers ─────────────────────────────────────────
function getMics(): string[] {
  try {
    const out = execSync("system_profiler SPAudioDataType 2>/dev/null", { encoding: "utf-8" });
    const names: string[] = [];
    for (const line of out.split("\n")) {
      const t = line.trim();
      if (t.endsWith(":") && !["Audio", "Devices", "Input", "Output"].some(x => t.startsWith(x))) {
        const n = t.replace(/:$/, "").trim();
        if (n && !names.includes(n)) names.push(n);
      }
    }
    return names.length ? names : ["default"];
  } catch { return ["default"]; }
}

function playSound(name: string) {
  try { execSync(`afplay /System/Library/Sounds/${name}.aiff &`, { stdio: "ignore" }); } catch {}
}

function trunc(s: string, max: number) {
  s = s.trim();
  return s.length <= max ? s : s.slice(0, max - 3) + "...";
}

// ─── Single Instance Lock ────────────────────────────
const LOCK_FILE = "/tmp/airtype.lock";

function ensureSingleInstance() {
  const { existsSync, readFileSync, writeFileSync, unlinkSync } = require("fs");

  if (existsSync(LOCK_FILE)) {
    const oldPid = parseInt(readFileSync(LOCK_FILE, "utf-8").trim(), 10);
    if (oldPid) {
      try {
        process.kill(oldPid, 0); // check if alive
        // Still running — kill it
        process.kill(oldPid, "SIGTERM");
        console.log(`  Stopped previous airtype (pid ${oldPid})`);
        // Wait a moment for cleanup
        Bun.sleepSync(500);
      } catch {
        // Not running, stale lock
      }
    }
    try { unlinkSync(LOCK_FILE); } catch {}
  }

  writeFileSync(LOCK_FILE, String(process.pid));

  // Clean up lock on exit
  const cleanup = () => { try { unlinkSync(LOCK_FILE); } catch {} };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });
}

// ─── Entry ───────────────────────────────────────────
if (process.argv.includes("--report")) {
  reportLogs().then(() => process.exit(0));
} else {
  ensureSingleInstance();
  // Report startup
  const cfg = loadConfig();
  if (isReady(cfg)) reportStartup(cfg);
  render(<App />);
}
