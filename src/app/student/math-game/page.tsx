import { requireRole } from "@/lib/auth";
import {
  getLeaderboardBoards,
  getMyBests,
  getOverallBlitzRank,
  getStudentYearLevel,
} from "./_queries";
import { BlitzArena } from "./_components/blitz-arena";

export default async function MathGamePage() {
  const user = await requireRole("student");
  const yearLevel = await getStudentYearLevel(user.id);
  const [myBests, allBoards, yearBoards, overallRank] = await Promise.all([
    getMyBests(user.id),
    getLeaderboardBoards(user.id),
    yearLevel ? getLeaderboardBoards(user.id, yearLevel) : Promise.resolve(null),
    getOverallBlitzRank(user.id),
  ]);

  return (
    <BlitzArena
      myBests={myBests}
      allBoards={allBoards}
      yearBoards={yearBoards}
      yearLevel={yearLevel}
      overallRank={overallRank}
    />
  );
}
