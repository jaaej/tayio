# Taiyo Blitz ranking

Implemented locally on 12 September 2026. No database migration is required.

- Desktop and mobile Taiyo Blitz entry controls display the signed-in student's
  whole-centre rank after a scored run.
- The game hero states the rank and total number of ranked players.
- Overall rank is the sum of the student's personal best across each of the five
  difficulties, preventing repeat attempts from inflating the result.
- Difficulty leaderboards can switch between the student's year level and all
  Taiyo students. Each scope loads all five difficulty boards in a single query,
  lists the top 20, and retains the student's separate row when outside the top
  20.
- Inactive accounts do not appear on the boards or affect rank.
