export type SoundName = "coin" | "pop" | "ding" | "zap" | "mute";

export const SOUND_OPTIONS: { name: SoundName; label: string }[] = [
  { name: "coin", label: "Coin" },
  { name: "pop", label: "Pop" },
  { name: "ding", label: "Ding" },
  { name: "zap", label: "Zap" },
  { name: "mute", label: "Mute" },
];

const STORAGE_KEY = "mathGameSound";

export function getPreferredSound(): SoundName {
  if (typeof window === "undefined") return "coin";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return SOUND_OPTIONS.some((o) => o.name === v) ? (v as SoundName) : "coin";
}

export function setPreferredSound(name: SoundName): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, name);
}

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

// One short tone; `notes` are [frequencyHz, startOffsetSec] pairs.
function blip(
  type: OscillatorType,
  notes: [number, number][],
  noteDur: number,
): void {
  const ac = audioCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  for (const [freq, at] of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = ac.currentTime + at;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDur);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + noteDur + 0.02);
  }
}

export function playSound(name: SoundName): void {
  switch (name) {
    case "mute":
      return;
    case "coin":
      // two quick ascending notes - classic pickup
      blip("square", [[988, 0], [1319, 0.07]], 0.12);
      return;
    case "pop":
      blip("sine", [[440, 0]], 0.09);
      return;
    case "ding":
      blip("triangle", [[1568, 0]], 0.22);
      return;
    case "zap":
      blip("sawtooth", [[1200, 0], [600, 0.05]], 0.1);
      return;
  }
}

// A single fixed low "wrong answer" buzz (two descending low tones). Not
// user-pickable; callers should skip it when the preferred sound is "mute".
export function playError(): void {
  blip("sawtooth", [[196, 0], [147, 0.09]], 0.16);
}
