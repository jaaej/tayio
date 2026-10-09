export function homeworkSolutionIsAvailable(input: {
  solutionUrl: string | null | undefined;
  dueDate: Date;
  now?: Date;
}): boolean {
  return Boolean(
    input.solutionUrl && input.dueDate.getTime() <= (input.now ?? new Date()).getTime(),
  );
}
