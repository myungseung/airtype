import { spawn } from "child_process";

export interface Recorder {
  stop: () => Promise<Buffer>;
  onVolume: (cb: (level: number) => void) => void;
}

/**
 * Record audio to stdout as raw PCM, calculate volume in JS,
 * accumulate buffer for WAV conversion on stop.
 * Single rec process — no device conflict.
 */
export function startRecording(micDevice = "default"): Recorder {
  // Switch macOS input device if specified
  if (micDevice !== "default") {
    try {
      const { execSync } = require("child_process");
      execSync(`SwitchAudioSource -t input -s "${micDevice}"`, { stdio: "ignore" });
    } catch {}
  }

  // Output raw PCM to stdout, 16kHz mono 16-bit
  const proc = spawn("rec", [
    "-q", "-r", "16000", "-c", "1", "-b", "16",
    "-t", "raw", "-",  // raw PCM to stdout
  ], { stdio: ["pipe", "pipe", "pipe"] });

  const chunks: Buffer[] = [];
  let volumeCb: ((level: number) => void) | null = null;

  proc.stdout?.on("data", (chunk: Buffer) => {
    chunks.push(chunk);

    if (!volumeCb) return;
    // Calculate RMS from raw 16-bit PCM
    let sum = 0;
    const samples = Math.floor(chunk.length / 2);
    for (let i = 0; i < chunk.length - 1; i += 2) {
      const sample = chunk.readInt16LE(i) / 32768;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / Math.max(samples, 1));
    // Voice RMS: ~0.005-0.3, noise floor: ~0.0001
    // Scale so normal speech fills ~60-80% of the bar
    const level = Math.min(1, rms * 20);
    volumeCb(level);
  });

  return {
    onVolume: (cb) => { volumeCb = cb; },
    stop: () =>
      new Promise((resolve, reject) => {
        proc.on("close", () => {
          try {
            const pcm = Buffer.concat(chunks);
            const wav = pcmToWav(pcm, 16000, 1, 16);
            resolve(wav);
          } catch (e) {
            reject(e);
          }
        });
        proc.kill("SIGTERM");
      }),
  };
}

/** Convert raw PCM to WAV buffer */
function pcmToWav(pcm: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);           // chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

/** Record for a fixed duration (for block tests) */
export async function recordDuration(seconds: number, micDevice = "default"): Promise<Buffer> {
  const tmpFile = `/tmp/airtype-${Date.now()}.wav`;

  const proc = spawn("rec", ["-q", "-r", "16000", "-c", "1", "-b", "16", tmpFile, "trim", "0", String(seconds)], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    proc.on("close", async () => {
      try {
        const file = Bun.file(tmpFile);
        const buffer = Buffer.from(await file.arrayBuffer());
        resolve(buffer);
      } catch (e) {
        reject(e);
      }
    });
    proc.on("error", reject);
  });
}
