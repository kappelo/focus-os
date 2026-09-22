import type { NotificationSchedule } from "@/lib/types";

const TRUSTED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];

export function validPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      TRUSTED_PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/** Latest occurrence at or before now, bounded to a 24h delivery window. */
export function duePushOccurrence(schedule: NotificationSchedule, now = new Date()) {
  if (!schedule.enabled) return null;
  const initial = new Date(schedule.scheduledAt);
  if (!Number.isFinite(initial.getTime()) || initial > now) return null;
  const step = schedule.repeat === "daily" ? 86_400_000 : schedule.repeat === "weekly" ? 7 * 86_400_000 : 0;
  const elapsed = now.getTime() - initial.getTime();
  const occurrence = new Date(initial.getTime() + (step ? Math.floor(elapsed / step) * step : 0));
  if (now.getTime() - occurrence.getTime() > 86_400_000) return null;
  return occurrence.toISOString();
}
