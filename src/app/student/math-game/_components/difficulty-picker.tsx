"use client";

import { useEffect, useState } from "react";
import {
  Rabbit,
  Sparkles,
  Flame,
  Swords,
  Brain,
  Star,
  type LucideIcon,
} from "lucide-react";
import { GameClient } from "./game-client";
import {
  SOUND_OPTIONS,
  getPreferredSound,
  setPreferredSound,
  playSound,
  type SoundName,
} from "./sound";
import type { Difficulty } from "./question-generator";
import type { MyBests } from "../_queries";

type Tier = {
  key: Difficulty;
  label: string;
  blurb: string;
  accent: string; // bright — solid top stripe + tile tint
  fg: string; // darker, readable — icon + "Best" text (≥4.5:1 on the light tint)
  icon: LucideIcon;
};

const TIERS: Tier[] = [
  { key: "sprint", label: "Sprint", blurb: "Addition up to 20", accent: "#1fa974", fg: "#0e7a4d", icon: Rabbit },
  { key: "easy", label: "Easy", blurb: "2-digit addition", accent: "#2e8fd6", fg: "#1e6fb0", icon: Sparkles },
  { key: "medium", label: "Medium", blurb: "Add, subtract, times tables", accent: "#f58a07", fg: "#b5610a", icon: Flame },
  { key: "hard", label: "Hard", blurb: "All four operations", accent: "#f2616b", fg: "#cc3a45", icon: Swords },
  { key: "genius", label: "Genius", blurb: "3-digit, powers, order of ops", accent: "#7b5bd6", fg: "#5b3fb0", icon: Brain },
];

export function DifficultyPicker({ myBests }: { myBests: MyBests }) {
  const [sound, setSound] = useState<SoundName>("coin");
  const [active, setActive] = useState<Difficulty | null>(null);

  useEffect(() => setSound(getPreferredSound()), []);

  const chooseSound = (name: SoundName) => {
    setSound(name);
    setPreferredSound(name);
    playSound(name);
  };

  if (active) {
    const tier = TIERS.find((t) => t.key === active)!;
    return (
      <div className="relative overflow-hidden rounded-[22px] border border-line bg-surface p-6 shadow-sm">
        <span
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ backgroundColor: tier.accent }}
        />
        <GameClient
          difficulty={active}
          sound={sound}
          myBest={myBests[active]}
          onExit={() => setActive(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-[16px] font-extrabold text-ink tracking-tight">
          Choose your level
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted mr-0.5">
            Sound
          </span>
          {SOUND_OPTIONS.map((o) => (
            <button
              key={o.name}
              onClick={() => chooseSound(o.name)}
              className={`h-8 px-3 rounded-full text-[12px] font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                sound === o.name
                  ? "bg-brand-500 text-white"
                  : "text-muted border border-line hover:bg-surface-2"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {TIERS.map((t) => {
          const Icon = t.icon;
          const special = t.key === "sprint";
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`group relative overflow-hidden text-left rounded-[22px] p-5 pt-6 cursor-pointer transition-all duration-200 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 ${
                special
                  ? "text-ink shadow-lg hover:shadow-xl"
                  : "border border-line bg-surface hover:shadow-lg"
              }`}
              style={
                special
                  ? {
                      backgroundImage:
                        "linear-gradient(135deg, #6ee7b7 0%, #34d399 45%, #10b981 100%)",
                      boxShadow: "0 14px 32px -12px rgba(16,185,129,0.55)",
                    }
                  : undefined
              }
            >
              {special ? (
                <>
                  <span className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/40 blur-xl" />
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink">
                    <Star className="h-3 w-3" /> Special
                  </span>
                </>
              ) : (
                <span
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{ backgroundColor: t.accent }}
                />
              )}
              <div
                className="relative h-14 w-14 grid place-items-center rounded-[16px] transition-transform group-hover:scale-105"
                style={
                  special
                    ? { backgroundColor: "rgba(255,255,255,0.5)", color: "#065f46" }
                    : { backgroundColor: `${t.accent}1f`, color: t.fg }
                }
              >
                <Icon className="h-7 w-7" />
              </div>
              <div className="relative mt-4 text-[18px] font-extrabold text-ink">
                {t.label}
              </div>
              <div
                className={`relative text-[13px] mt-1 leading-snug ${
                  special ? "text-ink/75" : "text-muted"
                }`}
              >
                {t.blurb}
              </div>
              <div
                className="relative mt-4 inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-bold tabular-nums"
                style={
                  special
                    ? { backgroundColor: "rgba(255,255,255,0.5)", color: "#065f46" }
                    : { backgroundColor: `${t.accent}1f`, color: t.fg }
                }
              >
                Best {myBests[t.key]}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
