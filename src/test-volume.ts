import { startRecording } from "./audio.js";

console.log("Recording 3s with volume monitoring...");
const rec = startRecording("default");

rec.onVolume((level) => {
  const bars = Math.round(level * 20);
  const bar = "█".repeat(bars) + "░".repeat(20 - bars);
  process.stdout.write(`\r  [${bar}] ${level.toFixed(3)}`);
});

setTimeout(async () => {
  const wav = await rec.stop();
  console.log(`\nDone. WAV: ${wav.length} bytes`);
  process.exit(0);
}, 3000);
