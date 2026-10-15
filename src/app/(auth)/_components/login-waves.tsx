/*
 * Four layered swells along the bottom of the sign-in screen's brand panel,
 * lightest at the back. Pure SVG + CSS so it costs no JavaScript and no
 * image download; each layer drifts sideways at its own speed.
 *
 * Each path is drawn across two viewBox widths (2 x VIEW_W) and every sine
 * period divides VIEW_W exactly, so translating a path left by VIEW_W lands
 * on an identical shape and the loop is seamless.
 */

const VIEW_W = 1440;
const VIEW_H = 300;
const STEP = 16;

type Wave = {
  base: number;
  amp: number;
  period: number;
  phase: number;
  // A slower secondary swell keeps the crests from looking mechanical.
  swellAmp: number;
  swellPeriod: number;
};

function waveY(wave: Wave, x: number) {
  return (
    wave.base +
    wave.amp * Math.sin((2 * Math.PI * x) / wave.period + wave.phase) +
    wave.swellAmp * Math.sin((2 * Math.PI * x) / wave.swellPeriod)
  );
}

function wavePath(wave: Wave) {
  const points: string[] = [];
  for (let x = 0; x <= VIEW_W * 2; x += STEP) {
    points.push(`${x} ${waveY(wave, x).toFixed(1)}`);
  }
  return `M${points.join("L")}L${VIEW_W * 2} ${VIEW_H}L0 ${VIEW_H}Z`;
}

/** Back to front: colours from the owner's sign-in mock. */
const LAYERS = [
  {
    fill: "#c7d8fc",
    speed: "login-wave-slow",
    wave: { base: 46, amp: 16, period: 1440, phase: 0.4, swellAmp: 10, swellPeriod: 720 },
  },
  {
    fill: "#b0cbfd",
    speed: "login-wave-mid",
    wave: { base: 116, amp: 16, period: 1440, phase: 2.2, swellAmp: 8, swellPeriod: 480 },
  },
  {
    fill: "#96b5f3",
    speed: "login-wave-fast",
    wave: { base: 186, amp: 14, period: 720, phase: 1.1, swellAmp: 10, swellPeriod: 1440 },
  },
  {
    fill: "#779ae0",
    speed: "login-wave-front",
    wave: { base: 246, amp: 10, period: 1440, phase: 3.4, swellAmp: 6, swellPeriod: 360 },
  },
];

export function LoginWaves() {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] w-full"
    >
      {LAYERS.map(({ fill, speed, wave }) => (
        <path key={fill} d={wavePath(wave)} fill={fill} className={`login-wave ${speed}`} />
      ))}
    </svg>
  );
}
