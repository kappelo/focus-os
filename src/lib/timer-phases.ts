import type { TimerMode } from "@/lib/types";

export function breakMinutesForMode(
  mode: TimerMode,
  completedSessions: number,
  longBreakAfter: number,
  longBreakMinutes: number,
) {
  const regular = Math.min(120, Math.max(0, Number(mode.break) || 0));
  if (regular === 0) return 0;
  const every = Math.max(2, Math.floor(Number(longBreakAfter) || 4));
  return completedSessions > 0 && completedSessions % every === 0
    ? Math.min(120, Math.max(1, Number(longBreakMinutes) || regular))
    : regular;
}
