/** Shown on every child page when no student is linked to the parent yet. */
export function EmptyChildrenNotice() {
  return (
    <div className="glass rounded-[24px] p-1.5">
      <div className="panel px-6 py-10 text-center">
        <h2 className="text-[16px] font-extrabold text-ink">No children linked</h2>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-soft">
          Your account isn&apos;t linked to a student yet. Ask the office to add a family link so
          you can see your child&apos;s lessons, homework and feedback.
        </p>
      </div>
    </div>
  );
}
