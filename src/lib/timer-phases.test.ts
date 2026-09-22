import { describe, expect, it } from "vitest";
import { DEFAULT_TIMER_MODES } from "@/lib/default-data";
import { breakMinutesForMode } from "@/lib/timer-phases";

describe("timer break configuration", () => {
  const pomodoro = DEFAULT_TIMER_MODES.find((mode) => mode.id === "pomodoro")!;
  it("uses five minutes for the normal Pomodoro break", () => {
    expect(breakMinutesForMode(pomodoro, 1, 4, 20)).toBe(5);
  });
  it("respects a user's mode-specific break, including zero", () => {
    expect(breakMinutesForMode({ ...pomodoro, break: 7 }, 1, 4, 20)).toBe(7);
    expect(breakMinutesForMode({ ...pomodoro, break: 0 }, 4, 4, 20)).toBe(0);
  });
  it("uses the configured long break after the chosen number of sessions", () => {
    expect(breakMinutesForMode(pomodoro, 4, 4, 18)).toBe(18);
  });
});
