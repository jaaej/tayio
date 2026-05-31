"use client";

import { useRef, useState } from "react";
import { markVideoWatched } from "../_actions";

export function VideoPlayer({
  src,
  subjectWeekId,
  alreadyWatched,
}: {
  src: string;
  subjectWeekId: string;
  alreadyWatched: boolean;
}) {
  const sent = useRef(alreadyWatched);
  const [, setTick] = useState(0);

  return (
    <video
      controls
      className="w-full rounded-xl bg-black"
      onPlay={() => {
        if (sent.current) return;
        sent.current = true;
        markVideoWatched(subjectWeekId).then(() => setTick((n) => n + 1));
      }}
    >
      <source src={src} />
    </video>
  );
}
