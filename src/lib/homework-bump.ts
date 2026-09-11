export function buildHomeworkBumpMessage(input: {
  studentFirstName: string;
  homeworkTitles: string[];
}): string {
  const name = input.studentFirstName.trim() || "there";
  const titles = input.homeworkTitles
    .map((title) => title.trim())
    .filter(Boolean)
    .slice(0, 5);
  const extra = Math.max(0, input.homeworkTitles.length - titles.length);
  const taskList = titles.map((title) => `“${title}”`).join(", ");
  const extraLabel = extra > 0 ? `, plus ${extra} more` : "";

  return (
    `Hi ${name}, this is a reminder that your overdue homework ` +
    `${titles.length === 1 ? "task is" : "tasks are"}: ${taskList}${extraLabel}. ` +
    "Please submit the work as soon as you can. If you need help, reply to this message."
  );
}
