"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateQuestion,
  type Difficulty,
  type Question,
} from "./question-generator";
import { playSound, playError, type SoundName } from "./sound";
import { submitScore } from "../_actions";

const ROUND_SECONDS = 60;

type Phase = "countdown" | "playing" | "done";

export function GameClient({
  difficulty,
  sound,
  myBest,
  onExit,
}: {
  difficulty: Difficulty;
  sound: SoundName;
  myBest: number;
  onExit: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("countdown");
  const [count, setCount] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [question, setQuestion] = useState<Question>(() =>
    generateQuestion(difficulty),
  );
  const [input, setInput] = useState("");
  const [neg, setNeg] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [score, setScore] = useState(0);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    void submitScore(difficulty, score).then(() => router.refresh());
  }, [phase, difficulty, score, router]);

  const advance = useCallback(() => {
    setScore((s) => s + 1);
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
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setInput("");
    setNeg(false);
    setWrong(false);
    setQuestion(generateQuestion(difficulty));
    setCount(3);
    setPhase("countdown");
  };

  if (phase === "countdown") {
    return (
      <div className="grid place-items-center py-20">
        <div className="text-[64px] font-extrabold text-brand-600 tabular-nums">
          {count > 0 ? count : "Go!"}
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const isRecord = score > myBest;
    return (
      <div className="grid place-items-center gap-4 py-16 text-center">
        <div className="text-[13px] uppercase tracking-[0.16em] text-muted">
          Time&apos;s up
        </div>
        <div className="text-[56px] font-extrabold text-ink tabular-nums leading-none">
          {score}
        </div>
        <div className="text-[14px] text-muted">questions solved</div>
        <div className="text-[13px] font-semibold text-brand-600">
          {isRecord
            ? "🎉 New personal best!"
            : `Your best: ${Math.max(myBest, score)}`}
        </div>
        <div className="flex gap-3 pt-2">
          <button
            onClick={restart}
            className="h-10 px-5 rounded-[14px] bg-brand-500 text-white text-[14px] font-semibold hover:bg-brand-600 transition-colors"
          >
            Play again
          </button>
          <button
            onClick={onExit}
            className="h-10 px-5 rounded-[14px] border border-line-strong text-ink text-[14px] font-semibold hover:bg-surface-2 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // phase === "playing"
  return (
    <div className="grid place-items-center gap-8 py-14">
      <div className="flex w-full max-w-md items-center justify-between text-[15px] font-semibold">
        <span className="text-muted">
          Score <span className="text-ink tabular-nums text-[17px]">{score}</span>
        </span>
        <span
          className={
            timeLeft <= 10
              ? "text-bad tabular-nums text-[17px]"
              : "text-muted tabular-nums text-[17px]"
          }
        >
          {timeLeft}s
        </span>
      </div>
      <div className="text-[60px] leading-none font-extrabold text-ink tabular-nums text-center">
        {question.text}
      </div>
      <div className="flex items-center gap-2.5">
        {difficulty === "genius" && (
          <button
            type="button"
            onClick={toggleSign}
            aria-label="Toggle negative sign"
            aria-pressed={neg}
            className={`h-[72px] w-[72px] shrink-0 rounded-[18px] border text-[30px] font-bold transition-colors ${
              neg
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-line-strong bg-surface text-ink hover:bg-surface-2"
            }`}
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
          className={`h-[72px] w-56 rounded-[18px] border-2 bg-surface text-center text-[36px] font-bold text-ink outline-none transition-colors ${
            wrong
              ? "border-bad ring-4 ring-bad/25"
              : "border-line-strong focus:border-brand-500"
          }`}
        />
      </div>
    </div>
  );
}
