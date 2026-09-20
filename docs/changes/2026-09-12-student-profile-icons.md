# Controlled student profile icons

Implemented locally and on the isolated test Supabase project on 12 September
2026. This is not production-deployed yet.

Students now have a Profile icon page with 12 labelled, code-rendered choices.
The selected icon appears in the student's desktop header and in the assigned
tutor's Students directory and student detail view. Initials remain the fallback
for students who have not selected an icon.

Migration `0049_student_profile_icons.sql` adds the nullable
`profiles.profile_avatar_key` column and a database allow-list constraint. The
student action applies the same allow-list, requires a student session, writes
only the signed-in profile, and uses the existing actor-aware profile audit.

These are generic interface icons, not the custom Taiyo imagery that remains
excluded from this implementation batch.
