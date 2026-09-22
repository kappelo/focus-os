import { describe, expect, it } from "vitest";
import { playTimerSignal } from "@/lib/timer-signal";

function audioStub(state: AudioContextState = "running") {
  const frequencies: number[] = [];
  const starts: number[] = [];
  const context = {
    state,
    currentTime: 10,
    destination: {},
    createOscillator: () => {
      const oscillator = {
        type: "sine",
        frequency: { value: 0 },
        connect: () => oscillator,
        start: (at: number) => { frequencies.push(oscillator.frequency.value); starts.push(at); },
        stop: () => undefined,
      };
      return oscillator;
    },
    createGain: () => {
      const gain = {
        gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        connect: () => gain,
      };
      return gain;
    },
  } as unknown as AudioContext;
  return { context, frequencies, starts };
}

describe("timer transition signals", () => {
  it("plays an ascending cue when a break starts", () => {
    const stub = audioStub();
    expect(playTimerSignal(stub.context, "break-start", 0.5)).toBe(true);
    expect(stub.frequencies).toEqual([523.25, 659.25]);
    expect(stub.starts).toEqual([10, 10.25]);
  });

  it("plays a different descending cue when focus resumes", () => {
    const stub = audioStub();
    expect(playTimerSignal(stub.context, "focus-start", 0.5)).toBe(true);
    expect(stub.frequencies).toEqual([659.25, 440]);
  });

  it("reports a suspended context instead of pretending that it played", () => {
    const stub = audioStub("suspended");
    expect(playTimerSignal(stub.context, "break-start", 0.5)).toBe(false);
    expect(stub.frequencies).toEqual([]);
  });
});
