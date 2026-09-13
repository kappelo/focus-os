"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches,
  );

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="quiet-copy">Aplikacja jest już zainstalowana na tym urządzeniu.</p>;
  if (!prompt) return <p className="quiet-copy">Użyj opcji „Zainstaluj aplikację” w menu przeglądarki, aby dodać Focus OS do ekranu urządzenia.</p>;
  return (
    <button
      className="button button-secondary"
      onClick={() =>
        void prompt.prompt().then(async () => {
          const result = await prompt.userChoice;
          if (result.outcome === "accepted") setPrompt(null);
        })
      }
    >
      <Download size={16} /> Zainstaluj Focus OS
    </button>
  );
}
