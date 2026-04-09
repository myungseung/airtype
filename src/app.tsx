import React, { useState, useEffect, useRef } from "react";
import { render, Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import { loadConfig, saveConfig, loadEnvKey, isReady, airpath, addWords, isOverLimit, getWeeklyRemaining, INPUT_LANGS, OUTPUT_LANGS, LANG_LABELS, type AirtypeConfig, type SystemLang } from "./config.js";
import { GlobalKeyboardListener } from "node-global-key-listener";
import { buildCombo, isModifier, isDuplicate } from "./keys.js";
import { startRecording } from "./audio.js";
import { transcribe } from "./stt.js";
import { polish } from "./llm.js";
import { pasteText, setPasteKeyListenerHooks, typeStatus, eraseChars } from "./paste.js";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { reportError, reportStartup, reportLogs, reportPaymentIntent } from "./report.js";

// ─── i18n ────────────────────────────────────────────
const strings = {
  ko: {
    pressToStart: (s: string) => `${s} 으로 시작`,
    recording: "녹음 중",
    processing: "처리 중...",
    youSaid: "You said:",
    result: "Result:",
    next: "Enter — 다음",
    setShortcut: "단축키를 정해주세요.",
    pressCombo: "원하는 키 조합을 눌러보세요.",
    comboExample: "(예: Cmd+Esc, Ctrl+Shift+R, Alt+Space)",
    waiting: "기다리는 중...",
    useThisKey: "이 키로 할까요?",
    confirmOrChange: "Enter — 확정  |  다른 키 — 변경",
    selectMic: "어떤 마이크를 사용할까요?",
    setupDone: "✓ 설정 완료!",
    nowPress: (s: string) => `이제 아무 앱에서 ${s} 을 누르면`,
    recStarts: "녹음이 시작됩니다. 소리로 알려드릴게요.",
    redoSetup: "설정을 다시 하려면: airtype --setup",
    enterStart: "Enter — 시작",
    settings: "Settings",
    back: "← 돌아가기",
    shortcut: "Shortcut",
    microphone: "Microphone",
    autoEnter: "Auto-Enter",
    systemLang: "시스템 언어",
    inputLang: "입력 언어",
    outputLang: "출력 언어",
    ready: "● Ready",
    weeklyLeft: (n: number) => `이번 주 남은 단어: ${n.toLocaleString()} / 10,000`,
    freeLimitHit: "무료 사용량이 소진되었습니다.",
    goPayment: "결제 페이지로 이동하시겠습니까?",
    yesNo: "Y — 이동  |  N — 닫기",
    keyNoDetect: "키 입력이 감지되지 않나요?",
    keyPermission: "시스템 설정 → 개인정보 보호 및 보안 → 입력 모니터링",
    keyAllow: "에서 이 터미널 앱을 허용해주세요.",
    keyRestart: "그래도 안 되면 Ctrl+C 후 터미널을 재시작하고 다시 실행하세요.",
    selectSystemLang: "언어를 선택하세요.",
    selectOutputLang: "출력 언어를 선택하세요.",
    guide1: { intro: "말을 더듬어도, Airtype이 깔끔하게 정리해줘요.", sentence: "Um so I think... no wait... we need to fix the login bug" },
    guide2: { intro: "나열하면 자동으로 번호를 매겨줘요.", sentence: "First update docs second fix the bug third deploy" },
    statusHint: "S settings  |  E auto-enter  |  Ctrl+C quit",
  },
  en: {
    pressToStart: (s: string) => `Press ${s} to start`,
    recording: "Recording",
    processing: "Processing...",
    youSaid: "You said:",
    result: "Result:",
    next: "Enter — next",
    setShortcut: "Choose your shortcut.",
    pressCombo: "Press the key combination you want.",
    comboExample: "(e.g. Cmd+Esc, Ctrl+Shift+R, Alt+Space)",
    waiting: "Waiting...",
    useThisKey: "Use this key?",
    confirmOrChange: "Enter — confirm  |  other key — change",
    selectMic: "Which microphone?",
    setupDone: "✓ Setup complete!",
    nowPress: (s: string) => `Press ${s} in any app to start`,
    recStarts: "recording. You'll hear a sound.",
    redoSetup: "To redo setup: airtype --setup",
    enterStart: "Enter — start",
    settings: "Settings",
    back: "← Back",
    shortcut: "Shortcut",
    microphone: "Microphone",
    autoEnter: "Auto-Enter",
    systemLang: "System Language",
    inputLang: "Input Language",
    outputLang: "Output Language",
    ready: "● Ready",
    weeklyLeft: (n: number) => `Words left this week: ${n.toLocaleString()} / 10,000`,
    freeLimitHit: "Free weekly limit reached.",
    goPayment: "Go to the payment page?",
    yesNo: "Y — open  |  N — close",
    keyNoDetect: "No key input detected?",
    keyPermission: "System Settings → Privacy & Security → Input Monitoring",
    keyAllow: "Allow this terminal app.",
    keyRestart: "If still not working, Ctrl+C, restart terminal, and try again.",
    selectSystemLang: "Select your language.",
    selectOutputLang: "Select output language.",
    guide1: { intro: "Even if you stutter, Airtype cleans it up.", sentence: "Um so I think... no wait... we need to fix the login bug" },
    guide2: { intro: "List items and it auto-numbers them.", sentence: "First update docs second fix the bug third deploy" },
    statusHint: "S settings  |  E auto-enter  |  Ctrl+C quit",
  },
};

type Strings = typeof strings.ko;
function t(lang: SystemLang): Strings { return strings[lang] || strings.ko; }

// ─── Logo ────────────────────────────────────────────
const LOGO = [
  "",
  "     █████╗ ██╗██████╗ ████████╗██╗   ██╗██████╗ ███████╗",
  "    ██╔══██╗██║██╔══██╗╚══██╔══╝╚██╗ ██╔╝██╔══██╗██╔════╝",
  "    ███████║██║██████╔╝   ██║    ╚████╔╝ ██████╔╝█████╗  ",
  "    ██╔══██║██║██╔══██╗   ██║     ╚██╔╝  ██╔═══╝ ██╔══╝  ",
  "    ██║  ██║██║██║  ██║   ██║      ██║   ██║     ███████╗",
  "    ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝     ╚══════╝",
  "",
  "              hands-free transcription v0.4",
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
    <Text color="cyan">  │   hands-free transcription v0.4    │</Text>
    <Text color="cyan">  ╰────────────────────────────────────╯</Text>
  </Box>
);

// ─── Speech Bar ──────────────────────────────────────
const SpeechBar = ({ level }: { level: number }) => {
  const width = 20;
  const filled = Math.round(level * width);
  return <Text color="cyan">[{"█".repeat(filled)}{"░".repeat(width - filled)}]</Text>;
};

// ─── Status Line ─────────────────────────────────────
type RecPhase = "wait" | "rec" | "proc" | "done";

const StatusLine = ({ phase, shortcut, result, volume, lang }: {
  phase: RecPhase;
  shortcut: string;
  result: { raw: string; pol: string } | null;
  volume: number;
  lang: SystemLang;
}) => {
  const s = t(lang);
  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
      {phase === "wait" && <Text dimColor>{s.pressToStart(shortcut)}</Text>}
      {phase === "rec" && (
        <Box>
          <Text color="red" bold><Spinner type="dots" /> {s.recording}  </Text>
          <SpeechBar level={volume} />
        </Box>
      )}
      {phase === "proc" && <Text color="yellow"><Spinner type="dots" /> {s.processing}</Text>}
      {phase === "done" && result && (
        <>
          <Text dimColor>{s.youSaid}  {result.raw.trim()}</Text>
          <Text bold color="green">{s.result}    {result.pol}</Text>
          <Box marginTop={1}><Text dimColor>{s.next}</Text></Box>
        </>
      )}
    </Box>
  );
};

// ─── Key Capture Hint ────────────────────────────────
const KeyCaptureHint = ({ lang }: { lang: SystemLang }) => {
  const [elapsed, setElapsed] = useState(0);
  const s = t(lang);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (elapsed < 5) return null;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="yellow" bold>{s.keyNoDetect}</Text>
      <Text dimColor>{s.keyPermission}</Text>
      <Text dimColor>{s.keyAllow}</Text>
      {elapsed >= 10 && (
        <Box marginTop={1}>
          <Text dimColor>{s.keyRestart}</Text>
        </Box>
      )}
    </Box>
  );
};

// ─── Auto-detect system language ────────────────────
function detectSystemLang(): SystemLang {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.startsWith("ko") ? "ko" : "en";
  } catch {
    return "en";
  }
}

// ─── Onboarding ──────────────────────────────────────
const TOTAL_STEPS = 6;

type StepId = 1 | 2 | 3 | 4 | 5 | 6;

const Onboarding = ({ config, onDone }: { config: AirtypeConfig; onDone: (c: AirtypeConfig) => void }) => {
  const [stepId, setStepId] = useState<StepId>(1);

  const detectedLang = detectSystemLang();
  const [cfg, setCfg] = useState({ ...config, inputLang: "auto", systemLang: detectedLang });
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

  const s = t(cfg.systemLang);
  const GUIDES = [s.guide1, s.guide2];

  // ── Global key listener ──
  useEffect(() => {
    const listener = new GlobalKeyboardListener();

    listener.addListener((e, isDown) => {
      if (e.state !== "DOWN") return;
      const name = e.name || "";
      if (isModifier(name)) return;
      const combo = buildCombo(name, isDown);

      // Step 2: shortcut capture
      if (stepRef.current === 2 && combo.includes("+")) {
        setCapturedCombo(combo);
        return true;
      }

      // Steps 4-5: recording toggle
      if (stepRef.current >= 4 && stepRef.current <= 5 && combo === cfgRef.current.shortcutDisplay && !isDuplicate(combo)) {
        if (phaseRef.current === "wait") {
          playSound("Glass");
          phaseRef.current = "rec";
          setPhase("rec");
          setVolume(0);
          const rec = startRecording(cfgRef.current.micDevice);
          rec.onVolume((v) => setVolume(v));
          recRef.current = rec;
        } else if (phaseRef.current === "rec" && recRef.current) {
          playSound("Pop");
          phaseRef.current = "proc";
          setPhase("proc");
          const r = recRef.current;
          recRef.current = null;
          r.stop().then(async (wav) => {
            try {
              const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const dir = airpath("recordings");
              mkdirSync(dir, { recursive: true });
              writeFileSync(`${dir}/onboard-${ts}.wav`, wav);

              const stt = await transcribe(wav, cfgRef.current.inputLang);
              const llm = await polish(stt.text, undefined, cfgRef.current.outputLang);
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
        return true;
      }
    });

    return () => listener.kill();
  }, []);

  // ── Enter key ──
  useInput((_, key) => {
    if (!key.return) return;
    const st = stepRef.current;
    const p = phaseRef.current;

    if (st === 2 && capturedCombo) {
      const updated = { ...cfgRef.current, shortcutDisplay: capturedCombo, shortcutKeys: capturedCombo.split("+") };
      cfgRef.current = updated;
      setCfg(updated);
      stepRef.current = 3;
      setStepId(3);
    }

    if (p === "done") {
      setResult(null);
      phaseRef.current = "wait";
      setPhase("wait");
      setVolume(0);

      if (st < 5) {
        stepRef.current = (st + 1) as StepId;
        setStepId((st + 1) as StepId);
      } else {
        const final = { ...cfgRef.current, onboardingDone: true };
        saveConfig(final);
        stepRef.current = 6;
        setStepId(6);
      }
    }

    // Congrats → daemon
    if (st === 6) {
      onDone(cfgRef.current);
    }
  });

  return (
    <Box flexDirection="column">
      {stepId !== 6 && (
        <>
          <LogoBox />
          <Box paddingLeft={2}><Text dimColor>[{stepId}/{TOTAL_STEPS}]</Text></Box>
        </>
      )}

      <Box flexDirection="column" paddingLeft={2} marginTop={1}>
        {/* Step 1: Output Language */}
        {stepId === 1 && (
          <>
            <Text bold>{s.selectOutputLang}</Text>
            <Box marginTop={1}>
              <SelectInput
                items={OUTPUT_LANGS.map(l => ({ label: LANG_LABELS[l]![cfg.systemLang], value: l }))}
                onSelect={(item) => {
                  const updated = { ...cfgRef.current, outputLang: item.value };
                  cfgRef.current = updated;
                  setCfg(updated);
                  stepRef.current = 2;
                  setStepId(2);
                }}
              />
            </Box>
          </>
        )}

        {/* Step 2: Shortcut */}
        {stepId === 2 && !capturedCombo && (
          <>
            <Text bold>{s.setShortcut}</Text>
            <Text dimColor>{s.pressCombo}</Text>
            <Text dimColor>{s.comboExample}</Text>
            <Box marginTop={1}><Text dimColor>{s.waiting}</Text></Box>
            <KeyCaptureHint lang={cfg.systemLang} />
          </>
        )}
        {stepId === 2 && capturedCombo && (
          <>
            <Box marginBottom={1}><Text bold color="cyan">{capturedCombo}</Text></Box>
            <Text>{s.useThisKey}</Text>
            <Text dimColor>{s.confirmOrChange}</Text>
          </>
        )}

        {/* Step 3: Mic */}
        {stepId === 3 && (
          <>
            <Text bold>{s.selectMic}</Text>
            <Box marginTop={1}>
              <SelectInput
                items={getMics().map(m => ({ label: m, value: m }))}
                onSelect={item => {
                  cfgRef.current = { ...cfgRef.current, micDevice: item.value };
                  setCfg(cfgRef.current);
                  stepRef.current = 4;
                  setStepId(4);
                }}
              />
            </Box>
          </>
        )}

        {/* Steps 4-5: Guided tests */}
        {stepId >= 4 && stepId <= 5 && (
          <>
            <Text>{GUIDES[stepId - 4]!.intro}</Text>
            <Box marginTop={1}>
              <Text bold color="white">"{GUIDES[stepId - 4]!.sentence}"</Text>
            </Box>
            <StatusLine phase={phase} shortcut={cfg.shortcutDisplay} result={result} volume={volume} lang={cfg.systemLang} />
          </>
        )}

        {/* Step 6: Congrats */}
        {stepId === 6 && (
          <>
            <LogoBox />
            <Box flexDirection="column" paddingLeft={2}>
              <Text bold color="green">{s.setupDone}</Text>
              <Text> </Text>
              <Text>{s.nowPress(cfg.shortcutDisplay)}</Text>
              <Text>{s.recStarts}</Text>
              <Text> </Text>
              <Text dimColor>{s.shortcut}: {cfg.shortcutDisplay}</Text>
              <Text dimColor>{s.microphone}: {cfg.micDevice}</Text>
              <Text dimColor>{s.outputLang}: {LANG_LABELS[cfg.outputLang]?.[cfg.systemLang] || cfg.outputLang}</Text>
              <Text> </Text>
              <Text dimColor>{s.redoSetup}</Text>
              <Text> </Text>
              <Text dimColor>{s.enterStart}</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

// ─── Daemon ──────────────────────────────────────────
type DState = "ready" | "rec" | "proc" | "limit";

const Daemon = ({ config, autoEnter, onToggleAutoEnter, onOpenSettings }: { config: AirtypeConfig; autoEnter: boolean; onToggleAutoEnter: () => void; onOpenSettings: () => void }) => {
  const [state, setState] = useState<DState>(isOverLimit(config) ? "limit" : "ready");
  const [last, setLast] = useState<{ raw: string; pol: string; stt: number; llm: number; paste: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vol, setVol] = useState(0);
  const sRef = useRef<DState>(isOverLimit(config) ? "limit" : "ready");
  const rRef = useRef<ReturnType<typeof startRecording> | null>(null);
  const autoEnterRef = useRef(autoEnter);
  autoEnterRef.current = autoEnter;

  const s = t(config.systemLang);

  useInput((input) => {
    if (sRef.current === "limit") {
      if (input === "y" || input === "Y") {
        reportPaymentIntent("yes");
        try { execSync('open "https://myungseung.github.io/airtype/#pricing"', { stdio: "ignore" }); } catch {}
      }
      if (input === "n" || input === "N") {
        reportPaymentIntent("no");
        sRef.current = "ready";
        setState("ready");
      }
      return;
    }
    if (input === "e" || input === "E") onToggleAutoEnter();
    if (input === "s" || input === "S") onOpenSettings();
  });

  useEffect(() => {
    const listener = new GlobalKeyboardListener();
    let listenerPaused = false;

    // Wire pause/resume so pasteText() can suspend the key listener
    // while injecting synthetic Cmd+V keystrokes via osascript.
    setPasteKeyListenerHooks(
      () => { listenerPaused = true; },
      () => { listenerPaused = false; },
    );

    listener.addListener((e, isDown) => {
      if (listenerPaused) return;
      const name = e.name || "";
      if (isModifier(name)) return;
      const combo = buildCombo(name, isDown);

      // Suppress shortcut key from reaching other apps on BOTH down and up.
      // NOTE: return true tells the native binary to suppress, but the MacKeyServer
      // binary is x86_64-only — on Apple Silicon, Rosetta 2 adds IPC latency that
      // often causes the CGEventTap to time out before the suppress response arrives.
      // Fallback: send a Backspace to erase any leaked character.
      if (combo === config.shortcutDisplay) {
        if (e.state !== "DOWN") return true;
        if (isDuplicate(combo)) return true;

        // Erase leaked shortcut character (e.g. backtick) + show status hint
        const REC_HINT = "[rec...]";
        const PROC_HINT = "[transcribing...]";

        // Block recording if over limit
        if (sRef.current === "limit") {
          setTimeout(() => { eraseChars(1); }, 30);
          return true;
        }

        if (sRef.current === "rec" && rRef.current) {
          playSound("Pop");
          sRef.current = "proc"; setState("proc");
          // Erase leaked char + recording hint → show transcribing hint
          setTimeout(() => {
            eraseChars(1 + REC_HINT.length);
            typeStatus(PROC_HINT);
          }, 30);
          const rec = rRef.current; rRef.current = null;
          rec.stop().then(async (wav) => {
            try {
              const t0 = Date.now();
              const stt = await transcribe(wav, config.inputLang);
              if (!stt.text.trim()) {
                eraseChars(PROC_HINT.length);
                sRef.current = "ready"; setState("ready");
                return;
              }
              const llm = await polish(stt.text, undefined, config.outputLang);
              eraseChars(PROC_HINT.length);
              const paste = await pasteText(llm.text, autoEnterRef.current);
              const total = Date.now() - t0;
              const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const dir = airpath("recordings");
              mkdirSync(dir, { recursive: true });
              writeFileSync(`${dir}/${ts}.wav`, wav);
              writeFileSync(`${dir}/${ts}.json`, JSON.stringify({ ts, rawText: stt.text, polishedText: llm.text, sttMs: stt.durationMs, llmMs: llm.durationMs, pasteMs: paste, totalMs: total }, null, 2));
              setLast({ raw: stt.text, pol: llm.text, stt: stt.durationMs, llm: llm.durationMs, paste, total });
              const overLimit = addWords(config, llm.text);
              setError(null);
              if (overLimit) {
                sRef.current = "limit"; setState("limit");
              } else {
                sRef.current = "ready"; setState("ready");
              }
            } catch (e: any) {
              eraseChars(PROC_HINT.length);
              setError(e.message); reportError("daemon-pipeline", e.message); sRef.current = "ready"; setState("ready");
            }
          });
        } else if (sRef.current === "ready") {
          if (isOverLimit(config)) {
            setTimeout(() => { eraseChars(1); }, 30);
            sRef.current = "limit"; setState("limit");
            return true;
          }
          playSound("Glass");
          // Erase leaked char → show recording hint
          setTimeout(() => {
            eraseChars(1);
            typeStatus(REC_HINT);
          }, 30);
          const rec = startRecording(config.micDevice);
          rec.onVolume((v) => setVol(v));
          rRef.current = rec;
          sRef.current = "rec"; setState("rec");
          setVol(0); setLast(null); setError(null);
        }
        return true;
      }

      // Non-shortcut keys: only process DOWN events
      if (e.state !== "DOWN") return;
    });
    return () => {
      setPasteKeyListenerHooks(() => {}, () => {});
      listener.kill();
    };
  }, []);

  return (
    <Box flexDirection="column" paddingLeft={2}>
      {state === "ready" && <Text color="green" bold>{s.ready}</Text>}
      {state === "rec" && (
        <Box>
          <Text color="red" bold><Spinner type="dots" /> {s.recording}  </Text>
          <SpeechBar level={vol} />
        </Box>
      )}
      {state === "proc" && <Text color="yellow"><Spinner type="dots" /> {s.processing}</Text>}
      {state === "limit" && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="red" bold>{s.freeLimitHit}</Text>
          <Text> </Text>
          <Text>{s.goPayment}</Text>
          <Text dimColor>{s.yesNo}</Text>
        </Box>
      )}
      {last && state !== "limit" && (
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
type SettingItem = "shortcut" | "mic" | "auto-enter" | "system-lang" | "input-lang" | "output-lang" | "back";
type SettingSub = null | "shortcut-capture" | "mic-select" | "system-lang-select" | "input-lang-select" | "output-lang-select";

const Settings = ({ config, onSave }: { config: AirtypeConfig; onSave: (c: AirtypeConfig) => void }) => {
  const [sub, setSub] = useState<SettingSub>(null);
  const [cfg, setCfg] = useState({ ...config });
  const [capturedCombo, setCapturedCombo] = useState("");
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const s = t(cfg.systemLang);

  // Shortcut capture listener
  useEffect(() => {
    if (sub !== "shortcut-capture") return;
    const listener = new GlobalKeyboardListener();
    listener.addListener((e, isDown) => {
      const name = e.name || "";
      if (isModifier(name)) return;
      const combo = buildCombo(name, isDown);
      if (!combo.includes("+")) return;
      if (e.state !== "DOWN") return true; // suppress UP too
      setCapturedCombo(combo);
      return true; // suppress key from reaching other apps during capture
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
      { label: `${s.shortcut}       ${cfg.shortcutDisplay}`, value: "shortcut" as SettingItem },
      { label: `${s.microphone}    ${cfg.micDevice}`, value: "mic" as SettingItem },
      { label: `${s.autoEnter}    ${cfg.autoEnter ? "ON" : "OFF"}`, value: "auto-enter" as SettingItem },
      { label: `${s.systemLang}    ${LANG_LABELS[cfg.systemLang]?.[cfg.systemLang] || cfg.systemLang}`, value: "system-lang" as SettingItem },
      { label: `${s.inputLang}    ${LANG_LABELS[cfg.inputLang]?.[cfg.systemLang] || cfg.inputLang}`, value: "input-lang" as SettingItem },
      { label: `${s.outputLang}    ${LANG_LABELS[cfg.outputLang]?.[cfg.systemLang] || cfg.outputLang}`, value: "output-lang" as SettingItem },
      { label: s.back, value: "back" as SettingItem },
    ];

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{s.settings}</Text>
        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={(item) => {
              if (item.value === "back") { onSave(cfg); return; }
              if (item.value === "shortcut") { setSub("shortcut-capture"); return; }
              if (item.value === "mic") { setSub("mic-select"); return; }
              if (item.value === "system-lang") { setSub("system-lang-select"); return; }
              if (item.value === "input-lang") { setSub("input-lang-select"); return; }
              if (item.value === "output-lang") { setSub("output-lang-select"); return; }
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
        <Text bold color="cyan">{s.shortcut}</Text>
        <Box marginTop={1}><Text dimColor>{s.pressCombo}</Text></Box>
        {capturedCombo ? (
          <>
            <Box marginTop={1}><Text bold color="cyan">{capturedCombo}</Text></Box>
            <Text dimColor>{s.confirmOrChange}  |  Esc — cancel</Text>
          </>
        ) : (
          <Box marginTop={1}><Text dimColor>{s.waiting}</Text></Box>
        )}
      </Box>
    );
  }

  // Sub: mic select
  if (sub === "mic-select") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{s.microphone}</Text>
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

  // Sub: system language
  if (sub === "system-lang-select") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{s.systemLang}</Text>
        <Box marginTop={1}>
          <SelectInput
            items={[
              { label: "한국어", value: "ko" },
              { label: "English", value: "en" },
            ]}
            onSelect={(item) => {
              const updated = { ...cfgRef.current, systemLang: item.value as SystemLang };
              saveConfig(updated);
              setCfg(updated);
              setSub(null);
            }}
          />
        </Box>
      </Box>
    );
  }

  // Sub: input language
  if (sub === "input-lang-select") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{s.inputLang}</Text>
        <Box marginTop={1}>
          <SelectInput
            items={INPUT_LANGS.map(l => ({ label: LANG_LABELS[l]![cfg.systemLang], value: l }))}
            onSelect={(item) => {
              const updated = { ...cfgRef.current, inputLang: item.value };
              saveConfig(updated);
              setCfg(updated);
              setSub(null);
            }}
          />
        </Box>
      </Box>
    );
  }

  // Sub: output language
  if (sub === "output-lang-select") {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text bold color="cyan">{s.outputLang}</Text>
        <Box marginTop={1}>
          <SelectInput
            items={OUTPUT_LANGS.map(l => ({ label: LANG_LABELS[l]![cfg.systemLang], value: l }))}
            onSelect={(item) => {
              const updated = { ...cfgRef.current, outputLang: item.value };
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
const StatusBox = ({ config, autoEnter }: { config: AirtypeConfig; autoEnter: boolean }) => {
  const s = t(config.systemLang);
  const remaining = getWeeklyRemaining(config);
  return (
    <Box flexDirection="column" paddingLeft={2} marginBottom={1}>
      <Text><Text dimColor>{s.shortcut}   </Text>  <Text bold>{config.shortcutDisplay}</Text></Text>
      <Text><Text dimColor>{s.microphone} </Text>  {config.micDevice}</Text>
      <Text><Text dimColor>{s.autoEnter} </Text>  {autoEnter ? <Text color="green">ON</Text> : <Text dimColor>OFF</Text>}</Text>
      <Text><Text dimColor>{s.outputLang} </Text>  {LANG_LABELS[config.outputLang]?.[config.systemLang] || config.outputLang}</Text>
      <Box marginTop={1}>
        <Text color={remaining === 0 ? "red" : remaining < 2000 ? "yellow" : "green"}>
          {s.weeklyLeft(remaining)}
        </Text>
      </Box>
      <Box marginTop={1}><Text dimColor>{s.statusHint}</Text></Box>
    </Box>
  );
};

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
        process.kill(oldPid, 0);
        process.kill(oldPid, "SIGTERM");
        console.log(`  Stopped previous airtype (pid ${oldPid})`);
        Bun.sleepSync(500);
      } catch {}
    }
    try { unlinkSync(LOCK_FILE); } catch {}
  }

  writeFileSync(LOCK_FILE, String(process.pid));

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
  const cfg = loadConfig();
  if (isReady(cfg)) reportStartup(cfg);
  render(<App />);
}
