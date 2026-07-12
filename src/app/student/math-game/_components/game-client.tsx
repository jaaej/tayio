"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateQuestion,
  type Difficulty,
  type Question,
} from "./question-generator";
import { playSound, type SoundName } from "./sound";
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
  const [score, setScore] = useState(0);
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
  }, [sound, difficulty]);

  const onChange = (value: string) => {
    setInput(value);
    // Auto-advance the instant the typed integer equals the answer.
    if (value.trim() !== "" && Number(value) === question.answer) advance();
  };

  const restart = () => {
    submitted.current = false;
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setInput("");
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
    <div className="grid place-items-center gap-6 py-12">
      <div className="flex w-full max-w-sm items-center justify-between text-[13px] font-semibold">
        <span className="text-muted">
          Score <span className="text-ink tabular-nums">{score}</span>
        </span>
        <span
          className={timeLeft <= 10 ? "text-bad tabular-nums" : "text-muted tabular-nums"}
        >
          {timeLeft}s
        </span>
      </div>
      <div className="text-[44px] font-extrabold text-ink tabular-nums text-center">
        {question.text}
      </div>
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && Number(input) === question.answer) advance();
        }}
        inputMode="numeric"
        autoComplete="off"
        aria-label="Your answer"
        className="h-14 w-40 rounded-[14px] border border-line-strong bg-surface text-center text-[28px] font-bold text-ink outline-none focus:border-brand-500"
      />
    </div>
  );
}
