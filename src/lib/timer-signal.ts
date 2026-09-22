export type TimerSignal = "break-start" | "focus-start";

// These are short UI cues, not ambience recordings. Two ascending notes mean
// rest; two descending notes mean return to work.
export function playTimerSignal(
  context: AudioContext,
  signal: TimerSignal,
  volume: number,
) {
  if (context.state !== "running") return false;
  const level = Math.min(1, Math.max(0, volume));
  if (level === 0) return true;
  const tones = signal === "break-start" ? [523.25, 659.25] : [659.25, 440];
  tones.forEach((frequency, index) => {
    const begin = context.currentTime + index * 0.25;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(0.13 * level, begin + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, begin + 0.42);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(begin);
    oscillator.stop(begin + 0.44);
  });
  return true;
}
