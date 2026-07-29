-- 0029_term_test_rls_tighten.sql - tighten student RLS on term test tables to
-- read-only. The 0028 student policies were `for all`, but every write to
-- term_test_attempts/term_test_answers goes through server-only code
-- (submitTermTest via Drizzle, which bypasses RLS), so students never need
-- write access. Left as `for all`, a student could self-insert a fake
-- perfect-score attempt directly via PostgREST using their own JWT.

begin;

drop policy if exists term_test_attempts_student_own on term_test_attempts;
drop policy if exists term_test_answers_student_own on term_test_answers;

create policy term_test_attempts_student_read on term_test_attempts
  for select to authenticated
  using (student_id = auth.uid());

create policy term_test_answers_student_read on term_test_answers
  for select to authenticated
  using (
    exists (select 1 from term_test_attempts a
            where a.id = attempt_id and a.student_id = auth.uid())
  );

commit;
