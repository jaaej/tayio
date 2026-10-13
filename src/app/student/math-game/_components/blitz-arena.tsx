"use client";

import { useEffect, useState } from "react";
import { GameClient } from "./game-client";
import { Leaderboard } from "./leaderboard";
import { Levels } from "./levels";
import type { Difficulty } from "./question-generator";
import { getPreferredSound, playSound, setPreferredSound, type SoundName } from "./sound";
import { BLITZ_BACKGROUND } from "./blitz-pattern";
import styles from "./blitz.module.css";
import type { BlitzOverallRank, LeaderboardBoards, MyBests } from "../_queries";

/** The lobby (hero, levels and leaderboard) and the round share one client
 * state: a round replaces the lobby, and leaving it can land on that level's
 * board. */
export function BlitzArena({
  myBests,
  allBoards,
  yearBoards,
  yearLevel,
  overallRank,
}: {
  myBests: MyBests;
  allBoards: LeaderboardBoards;
  yearBoards: LeaderboardBoards | null;
  yearLevel: string | null;
  overallRank: BlitzOverallRank;
}) {
  const [sound, setSound] = useState<SoundName>("coin");
  const [active, setActive] = useState<Difficulty | null>(null);
  const [boardLevel, setBoardLevel] = useState<Difficulty>("sprint");
  const [showBoard, setShowBoard] = useState(false);

  useEffect(() => setSound(getPreferredSound()), []);

  // After "Leaderboard" on the result screen, bring the board into view once
  // the lobby has rendered again.
  useEffect(() => {
    if (!showBoard || active) return;
    document.getElementById("blitz-leaderboard")?.scrollIntoView({ block: "start" });
    setShowBoard(false);
  }, [showBoard, active]);

  // A round starts at the top so the scoreboard and question are in view.
  const play = (level: Difficulty) => {
    setActive(level);
    window.scrollTo({ top: 0 });
  };

  const chooseSound = (name: SoundName) => {
    setSound(name);
    setPreferredSound(name);
    playSound(name);
  };

  if (active) {
    return (
      <GameClient
        key={active}
        difficulty={active}
        sound={sound}
        myBest={myBests[active]}
        onExit={(toLeaderboard) => {
          if (toLeaderboard) {
            setBoardLevel(active);
            setShowBoard(true);
          }
          setActive(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="blz-h"
        className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] p-[30px] text-white"
        style={{ background: BLITZ_BACKGROUND }}
      >
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-extrabold tracking-[0.14em] text-[#FFD600]">MENTAL MATHS</span>
          <h1 id="blz-h" className="text-[40px] font-extrabold leading-none tracking-[-0.02em] sm:text-[52px]">
            Taiyo Blitz
          </h1>
          <span className="text-[16px] font-semibold opacity-90">
            {overallRank
              ? `Rank #${overallRank.rank} of ${overallRank.totalPlayers} · best total ${overallRank.score}`
              : "Finish a round to get your rank"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => play("sprint")}
          className={`${styles.cta} flex h-[60px] items-center rounded-[18px] bg-[#FFD600] px-[30px] text-[18px] font-extrabold text-[#1B1240] shadow-[0_10px_0_#C9A800] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70`}
        >
          Play Sprint
        </button>
      </section>

      <div className="flex flex-wrap items-start gap-5">
        <Levels myBests={myBests} sound={sound} onSoundChange={chooseSound} onPlay={play} />
        <Leaderboard
          allBoards={allBoards}
          yearBoards={yearBoards}
          yearLevel={yearLevel}
          level={boardLevel}
          onLevelChange={setBoardLevel}
        />
      </div>
    </div>
  );
}
