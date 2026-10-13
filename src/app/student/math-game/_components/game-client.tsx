"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateQuestion,
  type Difficulty,
  type Question,
} from "./question-generator";
import { playSound, playError, type SoundName } from "./sound";
import { levelInfo } from "./level-info";
import { formatYear, roundOutcome, type RankChange } from "./standing";
import { submitScore } from "../_actions";
import { BLITZ_BACKGROUND, BLITZ_INDIGO } from "./blitz-pattern";
import styles from "./blitz.module.css";

type Phase = "countdown" | "playing" | "done";
type Save =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; rank: RankChange | null }
  | { status: "error" };

export function GameClient({
  difficulty,
  sound,
  myBest,
  onExit,
}: {
  difficulty: Difficulty;
  sound: SoundName;
  myBest: number;
  /** Leave the round; `toLeaderboard` opens this level's board. */
  onExit: (toLeaderboard: boolean) => void;
}) {
  const router = useRouter();
  const level = levelInfo(difficulty);
  const durationSeconds = level.seconds;
  const [phase, setPhase] = useState<Phase>("countdown");
  const [count, setCount] = useState(3);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [question, setQuestion] = useState<Question>(() =>
    generateQuestion(difficulty),
  );
  const [input, setInput] = useState("");
  const [neg, setNeg] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [score, setScore] = useState(0);
  const [correctBurst, setCorrectBurst] = useState(0);
  // The best this round has to beat, fixed when the round starts. The prop
  // refreshes once the score is saved, which would otherwise turn a new
  // record back into "not a record" on the result screen.
  const [roundBest, setRoundBest] = useState(myBest);
  const [save, setSave] = useState<Save>({ status: "idle" });
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const correctTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Countdown 3 -> 2 -> 1 -> play
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) {
      setPhase("playing");
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count]);

  // Focus the input when play starts
  useEffect(() => {
    if (phase === "playing") inputRef.current?.focus();
  }, [phase]);

  // Round timer
  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      setPhase("done");
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  // Submit final score once, when the round ends
  const submitted = useRef(false);
  useEffect(() => {
    if (phase !== "done" || submitted.current) return;
    submitted.current = true;
    // A scoreless run isn't recorded, so there's nothing to submit or refresh.
    if (score === 0) return;
    setSave({ status: "saving" });
    submitScore(difficulty, score)
      .then((result) => {
        setSave(result.ok ? { status: "saved", rank: result.rank } : { status: "error" });
        if (result.ok) router.refresh();
      })
      .catch(() => setSave({ status: "error" }));
  }, [phase, difficulty, score, router]);

  const advance = useCallback(() => {
    setScore((s) => s + 1);
    setCorrectBurst((burst) => burst + 1);
    if (correctTimer.current) clearTimeout(correctTimer.current);
    correctTimer.current = setTimeout(() => setCorrectBurst(0), 1200);
    playSound(sound);
    setQuestion(generateQuestion(difficulty));
    setInput("");
    setNeg(false);
    setWrong(false);
  }, [sound, difficulty]);

  // Brief red flash + error buzz for a completed wrong answer (honors mute).
  const flashWrong = useCallback(() => {
    if (sound !== "mute") playError();
    setWrong(true);
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    wrongTimer.current = setTimeout(() => setWrong(false), 320);
  }, [sound]);

  useEffect(() => () => {
    if (wrongTimer.current) clearTimeout(wrongTimer.current);
    if (correctTimer.current) clearTimeout(correctTimer.current);
  }, []);

  // Auto-advance the instant the entered value (digits + sign) equals the
  // answer; buzz once a wrong entry reaches the answer's digit length.
  const tryAnswer = useCallback(
    (digits: string, negative: boolean) => {
      if (digits === "") return;
      const value = negative ? -Number(digits) : Number(digits);
      if (value === question.answer) {
        advance();
        return;
      }
      const targetLen = String(Math.abs(question.answer)).length;
      if (digits.length >= targetLen) flashWrong();
    },
    [question.answer, advance, flashWrong],
  );

  // The numeric keypad has no minus key on mobile, so sign is entered via the
  // ± button (Genius only); the field itself holds digits only.
  const onChange = (raw: string) => {
    // Backspacing past the last digit leaves just "-"; clear the sign too.
    if (raw === "-") {
      setNeg(false);
      setInput("");
      return;
    }
    const digits = raw.replace(/[^0-9]/g, "");
    setInput(digits);
    tryAnswer(digits, neg);
  };

  const toggleSign = () => {
    const next = !neg;
    setNeg(next);
    tryAnswer(input, next);
    inputRef.current?.focus();
  };

  const restart = () => {
    submitted.current = false;
    setRoundBest((best) => Math.max(best, myBest, score));
    setSave({ status: "idle" });
    setScore(0);
    setTimeLeft(durationSeconds);
    setInput("");
    setNeg(false);
    setWrong(false);
    setCorrectBurst(0);
    if (correctTimer.current) clearTimeout(correctTimer.current);
    setQuestion(generateQuestion(difficulty));
    setCount(3);
    setPhase("countdown");
  };

  const shownBest = Math.max(roundBest, phase === "done" ? score : 0);
  const timerShare = (timeLeft / durationSeconds) * 100;

  if (phase === "done") {
    return (
      <RoundResult
        level={level.label}
        score={score}
        previousBest={roundBest}
        save={save}
        onPlayAgain={restart}
        onLeaderboard={() => onExit(true)}
      />
    );
  }

  return (
    <section
      aria-label="Taiyo Blitz game"
      className="flex min-h-[640px] flex-col gap-6 rounded-[30px] px-[18px] pb-[30px] pt-[22px] text-white sm:px-[26px] lg:min-h-[820px]"
      style={{ background: BLITZ_BACKGROUND }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onExit(false)}
            aria-label="Back to levels"
            className="grid h-[42px] w-[42px] place-items-center rounded-[13px] bg-white/[0.16] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={2.4} aria-hidden />
          </button>
          <h1 className="text-[22px] font-extrabold">{level.label}</h1>
        </div>
        <span className="text-[14px] font-bold opacity-85">Best {shownBest}</span>
      </div>

      <div className="flex items-center justify-between gap-4 px-2.5">
        <span className="flex flex-col gap-0.5">
          <span className="text-[12px] font-extrabold tracking-[0.1em] opacity-75">SCORE</span>
          <span className="text-[56px] font-extrabold leading-none tabular-nums sm:text-[72px]">{score}</span>
        </span>
        <div
          role="timer"
          aria-label={`${timeLeft} seconds left`}
          className="grid h-[120px] w-[120px] shrink-0 place-items-center rounded-full sm:h-[150px] sm:w-[150px]"
          style={{
            background: `conic-gradient(#FFD600 0 ${timerShare}%, rgba(255,255,255,.16) 0)`,
          }}
        >
          <span
            className="flex h-[98px] w-[98px] flex-col items-center justify-center rounded-full leading-none sm:h-[124px] sm:w-[124px]"
            style={{ background: BLITZ_INDIGO }}
          >
            <span className="text-[40px] font-extrabold tabular-nums sm:text-[52px]">{timeLeft}</span>
            <span className="text-[12px] font-extrabold tracking-[0.1em] opacity-75">SEC</span>
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-7 rounded-[28px] bg-white px-5 py-10 text-[#1B1240] shadow-[0_10px_0_rgba(0,0,0,0.18)]">
        {phase === "countdown" ? (
          <span aria-live="assertive" className="text-[104px] font-extrabold leading-none tabular-nums">
            {count > 0 ? count : "Go!"}
          </span>
        ) : (
          <>
            <span className="sr-only" aria-live="polite">
              {correctBurst > 0 ? `Correct. Score ${score}.` : ""}
            </span>
            {/* Fixed slot so the sum does not jump when "+1" appears. */}
            <span className="flex h-8 items-center">
              {correctBurst > 0 && (
                <span
                  key={correctBurst}
                  aria-hidden
                  className={`${styles.pop} flex h-8 items-center rounded-2xl bg-[#18B57E] px-3.5 text-[15px] font-extrabold text-white`}
                >
                  +1
                </span>
              )}
            </span>
            <span className="max-w-full break-words text-center text-[clamp(48px,12vw,104px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
              {question.text}
            </span>
            <div className="flex items-center gap-3">
              {difficulty === "genius" && (
                <button
                  type="button"
                  onClick={toggleSign}
                  aria-label="Toggle negative sign"
                  aria-pressed={neg}
                  className={cn(
                    "h-[96px] w-[80px] shrink-0 rounded-[24px] text-[40px] font-extrabold",
                    neg ? "bg-[#3B2BD1] text-white" : "bg-[#F1EEFF] text-[#1B1240]",
                  )}
                >
                  &minus;
                </button>
              )}
              <input
                ref={inputRef}
                value={neg ? `-${input}` : input}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") tryAnswer(input, neg);
                }}
                inputMode="numeric"
                autoComplete="off"
                aria-label="Your answer"
                aria-invalid={wrong || undefined}
                className="h-[96px] w-[min(260px,56vw)] rounded-[24px] border-0 bg-[#F1EEFF] text-center text-[56px] font-extrabold tabular-nums text-[#1B1240] outline outline-4"
                style={{ outlineColor: wrong ? "#E5484D" : "#3B2BD1" }}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Confetti pieces from the design, falling once. */
const CONFETTI_COLOURS = ["#FFD600", "#18B57E", "#3B6BFF", "#FF5A6E", "#FFFFFF", "#FF9F1C"];
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  x: (i * 37) % 100,
  w: 8 + (i % 3) * 3,
  h: 12 + (i % 4) * 3,
  colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
  duration: 4 + (i % 5),
  delay: (i % 6) * 0.6,
}));

function RoundResult({
  level,
  score,
  previousBest,
  save,
  onPlayAgain,
  onLeaderboard,
}: {
  level: string;
  score: number;
  previousBest: number;
  save: Save;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
}) {
  const rank = save.status === "saved" ? save.rank : null;
  const outcome = roundOutcome(score, previousBest, rank);
  const scope = rank ? (rank.scope === "year" ? formatYear(rank.yearLevel) : "All Taiyo") : "";
  const parts: string[] = [];
  if (outcome.upFrom !== null) parts.push(`Up from ${outcome.upFrom}`);
  if (!outcome.isRecord && previousBest > 0) parts.push(`Best ${previousBest}`);
  if (outcome.newRank !== null) {
    parts.push(`${parts.length ? "now" : "Now"} #${outcome.newRank} in ${scope}`);
  }

  return (
    <section
      aria-labelledby="rs-h"
      className="relative flex min-h-[640px] flex-col items-center justify-center gap-[18px] overflow-hidden rounded-[30px] px-[26px] py-10 text-center text-white lg:min-h-[820px]"
      style={{ background: BLITZ_BACKGROUND }}
    >
      {outcome.isRecord &&
        CONFETTI.map((piece, i) => (
          <span
            key={i}
            aria-hidden
            className={`${styles.fall} absolute -top-5 rounded-[3px]`}
            style={{
              left: `${piece.x}%`,
              width: piece.w,
              height: piece.h,
              background: piece.colour,
              animationDuration: `${piece.duration}s`,
              animationDelay: `${piece.delay}s`,
            }}
          />
        ))}
      <span className="text-[14px] font-extrabold tracking-[0.14em] text-[#FFD600]">
        TIME&rsquo;S UP · {level.toUpperCase()}
      </span>
      <h1 id="rs-h" className="text-[34px] font-extrabold sm:text-[42px]">
        {outcome.isRecord ? "New personal best" : "Round complete"}
      </h1>
      <span className="text-[112px] font-extrabold leading-none tabular-nums text-[#FFD600] sm:text-[140px]">
        {score}
      </span>
      <span className="min-h-[1.5em] text-[17px] font-bold opacity-90" aria-live="polite">
        {save.status === "saving" ? "Saving your score..." : save.status === "error" ? null : parts.join(" · ")}
      </span>
      {save.status === "error" && (
        <span role="alert" className="max-w-md text-balance text-[15px] font-bold text-[#FFD9DC]">
          This score couldn&apos;t be saved. Check your connection, then play again.
        </span>
      )}
      <div className="flex flex-wrap justify-center gap-3 pt-3.5">
        <button
          type="button"
          onClick={onPlayAgain}
          autoFocus
          className="flex h-[58px] items-center rounded-[18px] bg-[#FFD600] px-[30px] text-[18px] font-extrabold text-[#1B1240] shadow-[0_8px_0_#C9A800] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        >
          Play again
        </button>
        <button
          type="button"
          onClick={onLeaderboard}
          className="flex h-[58px] items-center rounded-[18px] bg-white px-6 text-[16px] font-extrabold text-[#1B1240] shadow-[0_8px_0_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70"
        >
          Leaderboard
        </button>
      </div>
    </section>
  );
}
