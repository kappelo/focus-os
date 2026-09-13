"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js").then(async (registration) => {
        const periodic = registration as ServiceWorkerRegistration & {
          periodicSync?: {
            register: (tag: string, options: { minInterval: number }) => Promise<void>;
          };
        };
        if (periodic.periodicSync) {
          await periodic.periodicSync
            .register("focus-os-reminders", { minInterval: 15 * 60_000 })
            .catch(() => undefined);
        }
      });
    }
  }, []);
  return null;
}
