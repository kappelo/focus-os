import "server-only";

import { createHash } from "node:crypto";
import webpush from "web-push";
import { query } from "@/lib/db";
import { duePushOccurrence, validPushEndpoint } from "@/lib/push-schedule";
import type { NotificationSchedule } from "@/lib/types";
import { parseWorkspace, serializeWorkspace } from "@/lib/workspace-crypto";

export type StoredPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
type SubscriptionRow = { id: string; user_id: string; payload: string; workspace_payload: string };

export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "https://github.com/kappelo/focus-os";
  return { available: Boolean(publicKey && privateKey), publicKey, privateKey, subject };
}

export function subscriptionId(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export function savePushSubscription(userId: string, subscription: StoredPushSubscription) {
  if (!validPushEndpoint(subscription.endpoint)) throw new Error("Nieobsługiwany adres usługi Push");
  const id = subscriptionId(subscription.endpoint);
  query(`INSERT INTO push_subscriptions (id, user_id, payload, active) VALUES (?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, payload = excluded.payload,
      active = 1, updated_at = CURRENT_TIMESTAMP`, [id, userId, serializeWorkspace(subscription)]);
  return id;
}

export function disablePushSubscription(userId: string, endpoint: string) {
  query("UPDATE push_subscriptions SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [subscriptionId(endpoint), userId]);
}

export async function sendPush(subscription: StoredPushSubscription, data: { id: string; title: string; body: string; kind?: string }) {
  const config = pushConfiguration();
  if (!config.available) throw new Error("Brak konfiguracji VAPID");
  if (!validPushEndpoint(subscription.endpoint)) throw new Error("Nieobsługiwany adres usługi Push");
  await webpush.sendNotification(subscription, JSON.stringify({
    id: data.id, title: data.title.slice(0, 120), body: data.body.slice(0, 240),
    url: data.kind === "review" ? "/?view=learn#flashcards" : data.kind === "exam" ? "/?view=more#exams" : "/?view=focus",
  }), { vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey }, TTL: 3600, timeout: 10000 });
}

export async function dispatchDuePush(now = new Date()) {
  if (!pushConfiguration().available) return { sent: 0, skipped: 0, failed: 0 };
  const rows = query<SubscriptionRow>(`SELECT p.id, p.user_id, p.payload, w.payload AS workspace_payload
    FROM push_subscriptions p JOIN user_workspaces w ON w.user_id = p.user_id WHERE p.active = 1`).rows;
  const result = { sent: 0, skipped: 0, failed: 0 };
  for (const row of rows) {
    let subscription: StoredPushSubscription;
    let schedules: NotificationSchedule[];
    try {
      subscription = parseWorkspace<StoredPushSubscription>(row.payload);
      schedules = parseWorkspace<{ notificationSchedules?: NotificationSchedule[] }>(row.workspace_payload).notificationSchedules ?? [];
    } catch {
      result.failed++;
      continue;
    }
    for (const schedule of schedules) {
      const occurrence = duePushOccurrence(schedule, now);
      if (!occurrence) continue;
      const claimed = query(`INSERT OR IGNORE INTO push_deliveries (subscription_id, schedule_id, occurrence_at)
        VALUES (?, ?, ?)`, [row.id, schedule.id, occurrence]).rowCount;
      if (!claimed) { result.skipped++; continue; }
      try {
        await sendPush(subscription, schedule);
        result.sent++;
      } catch (error) {
        const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (status === 404 || status === 410) {
          query("UPDATE push_subscriptions SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id]);
        } else {
          query("DELETE FROM push_deliveries WHERE subscription_id = ? AND schedule_id = ? AND occurrence_at = ?", [row.id, schedule.id, occurrence]);
        }
        result.failed++;
      }
    }
  }
  return result;
}
