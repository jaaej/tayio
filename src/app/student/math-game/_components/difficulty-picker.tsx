"use client";

import { useEffect, useState } from "react";
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

const TIERS: { key: Difficulty; label: string; blurb: string }[] = [
  { key: "sprint", label: "Sprint", blurb: "addition up to 20" },
  { key: "easy", label: "Easy", blurb: "2-digit addition" },
  { key: "medium", label: "Medium", blurb: "+ − and times tables" },
  { key: "hard", label: "Hard", blurb: "all four operations" },
  { key: "genius", label: "Genius", blurb: "3-digit, powers, order of ops" },
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
    return (
      <div className="rounded-[14px] border border-line bg-surface p-4">
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {TIERS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className="group text-left rounded-[14px] border border-line bg-surface p-4 hover:-translate-y-[3px] hover:shadow-md transition-all"
          >
            <div className="text-[15px] font-extrabold text-ink">{t.label}</div>
            <div className="text-[12px] text-muted mt-0.5">{t.blurb}</div>
            <div className="text-[12px] text-brand-600 font-semibold mt-2">
              Best: <span className="tabular-nums">{myBests[t.key]}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] font-semibold text-muted">Sound</span>
        {SOUND_OPTIONS.map((o) => (
          <button
            key={o.name}
            onClick={() => chooseSound(o.name)}
            className={`h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${
              sound === o.name
                ? "bg-brand-500 text-white"
                : "text-muted hover:bg-surface-2 border border-line"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
