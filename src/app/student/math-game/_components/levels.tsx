"use client";

import type { Difficulty } from "./question-generator";
import { LEVELS } from "./level-info";
import { SOUND_OPTIONS, type SoundName } from "./sound";
import styles from "./blitz.module.css";
import type { MyBests } from "../_queries";

/** Flat level colours with a darker bottom edge, from the design. */
const LOOK: Record<Difficulty, { bg: string; edge: string; fg: string }> = {
  sprint: { bg: "#FFD600", edge: "#C9A800", fg: "#1B1240" },
  easy: { bg: "#18B57E", edge: "#0E8A5F", fg: "#FFFFFF" },
  medium: { bg: "#3B6BFF", edge: "#2849C7", fg: "#FFFFFF" },
  hard: { bg: "#FF5A6E", edge: "#C93A4C", fg: "#FFFFFF" },
  genius: { bg: "#7B3FF2", edge: "#5726C2", fg: "#FFFFFF" },
};

export function Levels({
  myBests,
  sound,
  onSoundChange,
  onPlay,
}: {
  myBests: MyBests;
  sound: SoundName;
  onSoundChange: (sound: SoundName) => void;
  onPlay: (level: Difficulty) => void;
}) {
  return (
    <section aria-labelledby="lv-h" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
      <div className="flex items-center justify-between gap-2.5 px-1">
        <h2 id="lv-h" className="text-[18px] font-extrabold text-ink">
          Levels
        </h2>
        <label className="flex h-[34px] items-center gap-1.5 rounded-[10px] border border-white/95 bg-white/65 px-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-white">
          Sound
          <select
            value={sound}
            onChange={(e) => onSoundChange(e.target.value as SoundName)}
            className="cursor-pointer border-0 bg-transparent text-[13px] font-bold text-ink outline-none"
          >
            {SOUND_OPTIONS.map((option) => (
              <option key={option.name} value={option.name}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(200px,100%),1fr))] gap-3">
        {LEVELS.map((level) => {
          const look = LOOK[level.key];
          const dark = look.fg === "#1B1240";
          return (
            <button
              key={level.key}
              type="button"
              onClick={() => onPlay(level.key)}
              className={`${styles.level} flex min-h-[190px] flex-col gap-3 rounded-[22px] p-[18px] text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-400`}
              style={{ background: look.bg, color: look.fg, boxShadow: `0 6px 0 ${look.edge}` }}
            >
              <span className="flex w-full items-center justify-between">
                <span className="text-[12px] font-extrabold tracking-[0.06em] opacity-85">
                  {level.seconds} SEC
                </span>
                <span role="img" aria-label={`Difficulty ${level.step} of 5`} className="flex gap-[3px]">
                  {[1, 2, 3, 4, 5].map((pip) => (
                    <span
                      key={pip}
                      className="h-2 w-2 rounded-[4px]"
                      style={{
                        background:
                          pip <= level.step
                            ? dark
                              ? "#1B1240"
                              : "#FFFFFF"
                            : dark
                              ? "rgba(27,18,64,.2)"
                              : "rgba(255,255,255,.35)",
                      }}
                    />
                  ))}
                </span>
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[28px] font-extrabold tracking-[-0.01em]">{level.label}</span>
                <span className="text-[13px] font-semibold opacity-90">{level.summary}</span>
              </span>
              <span className="mt-auto flex w-full items-center justify-between gap-2">
                <span className="flex flex-col leading-[1.1]">
                  <span className="text-[11px] font-extrabold opacity-80">BEST</span>
                  <span className="text-[24px] font-extrabold tabular-nums">{myBests[level.key]}</span>
                </span>
                <span className="flex h-10 items-center rounded-[12px] bg-white px-[18px] text-[14px] font-extrabold text-ink">
                  Play
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
