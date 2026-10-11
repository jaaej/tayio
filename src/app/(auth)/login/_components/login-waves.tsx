/*
 * Flowing wave field for the login screen's right half. Pure SVG + CSS so it
 * costs no JavaScript and no image download.
 *
 * Each path is drawn across two viewBox widths (2 x VIEW_W) and every sine
 * period divides VIEW_W exactly, so translating a path left by VIEW_W lands
 * on an identical shape and the loop is seamless.
 */

const VIEW_W = 1440;
const VIEW_H = 640;
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

function wavePath(wave: Wave, closed: boolean) {
  const points: string[] = [];
  for (let x = 0; x <= VIEW_W * 2; x += STEP) {
    points.push(`${x} ${waveY(wave, x).toFixed(1)}`);
  }
  const line = `M${points.join("L")}`;
  return closed ? `${line}L${VIEW_W * 2} ${VIEW_H}L0 ${VIEW_H}Z` : line;
}

const FILLS = [
  {
    wave: { base: 330, amp: 26, period: 720, phase: 0, swellAmp: 18, swellPeriod: 1440 },
    gradient: "login-wave-back",
    className: "login-wave login-wave-slow",
  },
  {
    wave: { base: 410, amp: 22, period: 480, phase: 1.2, swellAmp: 16, swellPeriod: 1440 },
    gradient: "login-wave-mid",
    className: "login-wave login-wave-mid",
  },
  {
    wave: { base: 490, amp: 18, period: 360, phase: 2.4, swellAmp: 12, swellPeriod: 720 },
    gradient: "login-wave-front",
    className: "login-wave login-wave-fast",
  },
];

const LINES = [
  { base: 230, amp: 20, period: 720, phase: 0.6, swellAmp: 22, swellPeriod: 1440 },
  { base: 262, amp: 16, period: 480, phase: 2.1, swellAmp: 18, swellPeriod: 1440 },
  { base: 294, amp: 14, period: 360, phase: 3.3, swellAmp: 14, swellPeriod: 720 },
];

export function LoginWaves() {
  return (
    <div
      aria-hidden="true"
      className="login-waves pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] lg:block"
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[62%] w-full"
      >
        <defs>
          <linearGradient id="login-wave-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--periwinkle-500)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--periwinkle-600)" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="login-wave-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--periwinkle-600)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--periwinkle-700)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="login-wave-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--periwinkle-700)" stopOpacity="0.38" />
            <stop offset="100%" stopColor="var(--periwinkle-700)" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {LINES.map((wave, i) => (
          <path
            key={`line-${i}`}
            d={wavePath(wave, false)}
            fill="none"
            stroke="var(--navy-800)"
            strokeOpacity={0.16 - i * 0.03}
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
            className={`login-wave ${i === 0 ? "login-wave-slow" : i === 1 ? "login-wave-mid" : "login-wave-fast"}`}
          />
        ))}
        {FILLS.map(({ wave, gradient, className }) => (
          <path
            key={gradient}
            d={wavePath(wave, true)}
            fill={`url(#${gradient})`}
            className={className}
          />
        ))}
      </svg>
    </div>
  );
}
