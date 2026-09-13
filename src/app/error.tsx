"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[Focus OS] Nieobsłużony błąd interfejsu", error);
  }, [error]);

  return (
    <main className="error-page">
      <section className="panel">
        <span><AlertTriangle size={25} /></span>
        <p className="eyebrow">FOCUS OS NADAL CHRONI TWOJE DANE</p>
        <h1>Ten widok napotkał problem</h1>
        <p>
          Spróbuj ponownie. Dane zapisane lokalnie i w SQLite nie są usuwane
          przez ten błąd.
        </p>
        <button className="button button-primary button-large" onClick={retry}>
          <RefreshCw size={18} /> Spróbuj ponownie
        </button>
        {error.digest ? <small>Identyfikator: {error.digest}</small> : null}
      </section>
    </main>
  );
}
