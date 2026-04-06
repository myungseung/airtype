import { spawn } from "child_process";

const proc = spawn("rec", ["-q", "-r", "16000", "-c", "1", "-b", "16", "-t", "raw", "-"], {
  stdio: ["pipe", "pipe", "pipe"],
});

let total = 0;
let chunks = 0;

proc.stdout!.on("data", (chunk: Buffer) => {
  chunks++;
  total += chunk.length;
  // Calculate RMS
  let sum = 0;
  const samples = Math.floor(chunk.length / 2);
  for (let i = 0; i < chunk.length - 1; i += 2) {
    const sample = chunk.readInt16LE(i) / 32768;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / Math.max(samples, 1));
  console.log(`chunk #${chunks}: ${chunk.length}b, total=${total}, rms=${rms.toFixed(6)}`);
});

setTimeout(() => {
  proc.kill("SIGTERM");
}, 3000);

proc.on("close", () => {
  console.log(`Done. ${chunks} chunks, ${total} bytes`);
  process.exit(0);
});
