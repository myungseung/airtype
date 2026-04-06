import { startRecording } from "./audio.js";

console.log("Recording 5s — speak into your mic...");
const rec = startRecording("default");

let count = 0;
rec.onVolume((level) => {
  count++;
  // Print every callback
  console.log(`vol #${count}: ${level.toFixed(4)}`);
});

setTimeout(async () => {
  const wav = await rec.stop();
  console.log(`Done. WAV: ${wav.length} bytes, callbacks: ${count}`);
  process.exit(0);
}, 5000);
