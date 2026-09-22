import { describe, expect, it } from "vitest";
import { duePushOccurrence, validPushEndpoint } from "@/lib/push-schedule";
import type { NotificationSchedule } from "@/lib/types";

const item: NotificationSchedule = { id: "n", title: "Nauka", body: "Start", scheduledAt: "2026-09-22T10:00:00Z", repeat: "daily", kind: "study",
  enabled: true, createdAt: "2026-09-20T10:00:00Z", updatedAt: "2026-09-20T10:00:00Z" };

describe("push scheduling", () => {
  it("rejects local and disguised endpoints", () => {
    expect(validPushEndpoint("https://fcm.googleapis.com/fcm/send/a")).toBe(true);
    expect(validPushEndpoint("http://127.0.0.1/push")).toBe(false);
    expect(validPushEndpoint("https://fcm.googleapis.com.evil.test/push")).toBe(false);
  });
  it("finds the current repeated occurrence but skips stale one-time alerts", () => {
    expect(duePushOccurrence(item, new Date("2026-09-24T10:05:00Z"))).toBe("2026-09-24T10:00:00.000Z");
    expect(duePushOccurrence({ ...item, repeat: "none" }, new Date("2026-09-25T10:00:00Z"))).toBeNull();
  });
});
