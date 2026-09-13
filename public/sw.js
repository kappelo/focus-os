const CACHE = "focus-os-v6";
const RUNTIME_CACHE = "focus-os-runtime-v6";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("focus-os-") && key !== CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/"))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "focus-os-sync") {
    event.waitUntil(broadcast({ type: "FOCUS_SYNC_REQUEST" }));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "focus-os-reminders") {
    event.waitUntil(broadcast({ type: "FOCUS_CHECK_REMINDERS" }));
  }
});

self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  event.waitUntil(showFocusNotification(data));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    event.waitUntil(showFocusNotification(event.data.payload ?? {}));
  }
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action || "open";
  const notificationId = event.notification.data?.id ?? "";
  event.notification.close();
  const target = action === "start"
    ? "/?view=focus&notificationAction=start"
    : action === "snooze"
      ? `/?view=home&notificationAction=snooze&notificationId=${encodeURIComponent(notificationId)}`
      : action === "done"
        ? `/?view=home&notificationAction=done&notificationId=${encodeURIComponent(notificationId)}`
        : event.notification.data?.url || "/";
  event.waitUntil(openOrFocus(target));
});

async function showFocusNotification(data) {
  return self.registration.showNotification(data.title || "Focus OS", {
    body: data.body || "Czas na zaplanowaną naukę.",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: data.tag || `focus-os-${data.id || "reminder"}`,
    renotify: true,
    vibrate: [120, 60, 120],
    data: { id: data.id, url: data.url || "/" },
    actions: [
      { action: "start", title: "Rozpocznij" },
      { action: "snooze", title: "Odłóż 10 min" },
      { action: "done", title: "Gotowe" },
    ],
  });
}

async function broadcast(message) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach((client) => client.postMessage(message));
}

async function openOrFocus(path) {
  const absolute = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if ("focus" in client) {
      if ("navigate" in client) await client.navigate(absolute);
      return client.focus();
    }
  }
  return self.clients.openWindow ? self.clients.openWindow(absolute) : undefined;
}
