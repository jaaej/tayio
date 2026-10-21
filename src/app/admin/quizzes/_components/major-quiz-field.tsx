/**
 * "Major quiz" on New quiz: its scores count towards the term report's 1 to 6
 * ratings, with the topic tests. Practice quizzes stay out of them.
 */
export function MajorQuizField({ id, defaultChecked = false }: { id: string; defaultChecked?: boolean }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-line-field px-3.5 py-3">
      <input
        id={id}
        name="isMajor"
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#17152B]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-bold text-ink">Major quiz</span>
        <span className="text-[13px] text-ink-soft">Counts towards term report ratings, with the topic tests.</span>
      </span>
    </label>
  );
}
