/**
 * Status enum → human label + Tailwind style maps.
 * Single source of truth for every status pill in every role portal.
 */

export const LESSON_STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  missed: "Missed",
  rescheduled: "Rescheduled",
  makeup: "Make-up class",
};

export const LESSON_STATUS_STYLE: Record<string, string> = {
  upcoming: "bg-brand-100 text-navy-800",
  completed: "bg-brand-50 text-ink-soft",
  cancelled: "bg-rose-100 text-rose-800",
  missed: "bg-amber-100 text-amber-900",
  rescheduled: "bg-amber-100 text-amber-900",
  makeup: "bg-emerald-100 text-emerald-900",
};

export const HOMEWORK_STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  viewed: "Viewed",
  submitted: "Submitted",
  late: "Late",
  marked: "Marked",
  returned: "Returned",
  resubmission_requested: "Resubmit",
};

export const HOMEWORK_STATUS_STYLE: Record<string, string> = {
  not_started: "bg-brand-100 text-navy-800",
  viewed: "bg-brand-100 text-navy-800",
  submitted: "bg-emerald-100 text-emerald-900",
  late: "bg-amber-100 text-amber-900",
  marked: "bg-emerald-100 text-emerald-900",
  returned: "bg-emerald-100 text-emerald-900",
  resubmission_requested: "bg-rose-100 text-rose-800",
};

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  left_early: "Left early",
  makeup_attended: "Make-up attended",
};

export const ATTENDANCE_STATUS_STYLE: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-900",
  absent: "bg-rose-100 text-rose-800",
  late: "bg-amber-100 text-amber-900",
  left_early: "bg-amber-100 text-amber-900",
  makeup_attended: "bg-brand-100 text-navy-800",
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  overdue: "Overdue",
  partially_paid: "Partial",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export const INVOICE_STATUS_STYLE: Record<string, string> = {
  unpaid: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  overdue: "bg-rose-100 text-rose-800",
  partially_paid: "bg-amber-100 text-amber-900",
  refunded: "bg-brand-100 text-navy-800",
  cancelled: "bg-brand-50 text-ink-soft",
};

export const MASTERY_LABEL: Record<string, string> = {
  not_started: "Not started",
  needs_work: "Needs work",
  improving: "Improving",
  strong: "Strong",
};
