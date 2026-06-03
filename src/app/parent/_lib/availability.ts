// Availability logic moved to src/lib/availability.ts so admin reschedule
// can reuse it. This file just re-exports for any callers still importing
// the parent-local path.
export {
  getEligibleTutors,
  getAvailableSlots,
  type AvailableSlot,
} from "@/lib/availability";
