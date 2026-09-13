"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Cloud,
  CloudOff,
  Leaf,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import {
  connectLocalProfile,
  createLocalProfile,
  reauthorizeCurrentDevice,
  verifyLocalPin,
} from "@/lib/storage";
import type { LocalProfile } from "@/lib/types";

type AuthMode = "local" | "cloud" | "register";
type RemoteUser = {
  id: string;
  username: string;
  name: string;
  role: "user" | "admin";
};

export function AuthScreen({
  profiles,
  onSuccess,
}: {
  profiles: LocalProfile[];
  onSuccess: (profile: LocalProfile, notice?: string) => void;
}) {
  const [mode, setMode] = useState<AuthMode>(
    profiles.length ? "local" : "cloud",
  );
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [totp, setTotp] = useState("");
  const [pendingPinChange, setPendingPinChange] = useState<RemoteUser | null>(null);
  const [newPin, setNewPin] = useState("");
  const selected = useMemo(
    () => profiles.find((profile) => profile.id === selectedId),
    [profiles, selectedId],
  );

  async function loginToCloud() {
    if (!/^[a-z0-9_-]{3,32}$/.test(username.trim().toLowerCase())) {
      setError("Podaj poprawny login konta.");
      return;
    }
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ username, pin, ...(twoFactorRequired ? { totp } : {}) }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      user?: RemoteUser;
      error?: string;
      requiresTwoFactor?: boolean;
      mustChangePin?: boolean;
    };
    if (!response.ok || !data.user) {
      if (data.requiresTwoFactor) setTwoFactorRequired(true);
      setError(
        response.status === 503
          ? "SQLite jest chwilowo niedostępna. Uruchom aplikację ponownie i spróbuj ponownie."
          : (data.error ?? "Nie udało się zalogować do chmury."),
      );
      return;
    }
    if (data.mustChangePin) {
      setPendingPinChange(data.user);
      setError("");
      return;
    }
    await finishRemoteLogin(data.user, pin);
  }

  async function finishRemoteLogin(user: RemoteUser, profilePin: string) {
    reauthorizeCurrentDevice(user.id);
    const local = profiles.find(
      (profile) => profile.username === user.username,
    );
    const profile = local
      ? await connectLocalProfile(local, profilePin, user)
      : await createLocalProfile({
          username: user.username,
          name: user.name,
          pin: profilePin,
          serverLinked: true,
          serverUserId: user.id,
          role: user.role,
        });
    onSuccess(
      profile,
      "Konto połączone. Pobieramy dane z pozostałych urządzeń.",
    );
  }

  async function changeInitialPin(event: FormEvent) {
    event.preventDefault();
    if (!pendingPinChange || !/^\d{4,10}$/.test(newPin) || newPin === "1234") {
      setError("Ustaw nowy PIN z 4–10 cyfr, inny niż 1234.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/change-pin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ currentPin: pin, newPin }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) { setError(data.error ?? "Nie udało się zmienić PIN-u."); return; }
      await finishRemoteLogin(pendingPinChange, newPin);
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!/^\d{4,10}$/.test(pin)) {
        setError("PIN musi składać się z 4–10 cyfr.");
        return;
      }
      if (mode === "cloud") {
        await loginToCloud();
        return;
      }
      if (mode === "local") {
        if (!selected || !(await verifyLocalPin(selected, pin))) {
          setError("Nieprawidłowy PIN.");
          return;
        }
        let notice: string | undefined;
        if (selected.serverLinked && navigator.onLine) {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({ username: selected.username, pin }),
          });
          if (response.status === 428) {
            setUsername(selected.username);
            setMode("cloud");
            setTwoFactorRequired(true);
            setError("To konto używa 2FA. Podaj kod z aplikacji uwierzytelniającej.");
            return;
          }
          if (!response.ok) {
            notice =
              "Zalogowano lokalnie — synchronizacja spróbuje ponownie później.";
          }
        } else if (!navigator.onLine) {
          notice =
            "Zalogowano offline. Zmiany zsynchronizują się po powrocie sieci.";
        }
        onSuccess(selected, notice);
        return;
      }

      if (!/^[a-z0-9_-]{3,32}$/.test(username.trim().toLowerCase())) {
        setError("Login: 3–32 znaki, małe litery, cyfry, _ lub -.");
        return;
      }
      if (name.trim().length < 2) {
        setError("Podaj nazwę o długości co najmniej 2 znaków.");
        return;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ username, name, pin }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        user?: RemoteUser;
        error?: string;
      };
      if (!response.ok || !data.user) {
        setError(
          response.status === 503
            ? "SQLite jest chwilowo niedostępna. Uruchom aplikację ponownie i spróbuj ponownie."
            : (data.error ?? "Nie udało się utworzyć konta."),
        );
        return;
      }
      const profile = await createLocalProfile({
        username: data.user.username,
        name: data.user.name,
        pin,
        serverLinked: true,
        serverUserId: data.user.id,
        role: data.user.role,
      });
      onSuccess(
        profile,
        "Konto utworzone w SQLite i gotowe do synchronizacji.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === "ConstraintError"
          ? "Taki profil już istnieje na tym urządzeniu."
          : cause instanceof Error && /IndexedDB|storage/i.test(cause.message)
            ? "Przeglądarka zablokowała pamięć aplikacji. Włącz dane witryn dla tej strony i spróbuj ponownie."
            : `Nie udało się zapisać profilu${cause instanceof Error && cause.message ? `: ${cause.message}` : "."}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode === "local"
      ? "Odblokuj Focus OS"
      : mode === "cloud"
        ? "Połącz to urządzenie"
        : "Utwórz konto synchronizowane";

  if (pendingPinChange) return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand brand-large"><span className="brand-mark"><Leaf size={24} /></span><span>Focus OS</span></div>
        <p className="eyebrow">PIERWSZE LOGOWANIE</p>
        <h1>Zabezpiecz swoje konto.</h1>
        <p className="auth-lead">Startowy PIN 1234 jest publiczny. Zanim otworzymy dane i synchronizację, ustaw własny PIN.</p>
      </section>
      <section className="auth-card">
        <div className="auth-icon"><ShieldCheck size={23} /></div>
        <p className="eyebrow">WYMAGANA ZMIANA PIN-U</p>
        <h2>Witaj, {pendingPinChange.name}</h2>
        <form onSubmit={changeInitialPin} className="form-stack">
          <label>Nowy PIN<input value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="4–10 cyfr" inputMode="numeric" type="password" autoComplete="new-password" autoFocus /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button-primary button-large" disabled={busy} type="submit">{busy ? "Zapisuję…" : "Zmień PIN i przejdź dalej"}<ArrowRight size={18} /></button>
        </form>
      </section>
    </main>
  );

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand brand-large">
          <span className="brand-mark">
            <Leaf size={24} />
          </span>
          <span>Focus OS</span>
        </div>
        <p className="eyebrow">STUDY &amp; FOCUS, NA KAŻDYM URZĄDZENIU</p>
        <h1>
          Zacznij tutaj.
          <br />
          Kontynuuj wszędzie.
        </h1>
        <p className="auth-lead">
          Telefon, tablet i komputer pracują na jednym zaszyfrowanym koncie, a
          tryb offline zachowuje każdą zmianę do następnej synchronizacji.
        </p>
        <div className="auth-benefits">
          <span>
            <ShieldCheck size={18} /> PIN hashowany lokalnie i na serwerze
          </span>
          <span>
            <CloudOff size={18} /> Offline-first z SQLite
          </span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-icon">
          {mode === "cloud" ? <Cloud size={23} /> : <LockKeyhole size={23} />}
        </div>
        <p className="eyebrow">
          {mode === "local"
            ? "PROFIL NA TYM URZĄDZENIU"
            : mode === "cloud"
              ? "MAM JUŻ KONTO"
              : "NOWE KONTO SQLITE"}
        </p>
        <h2>{heading}</h2>
        <p>
          {mode === "local"
            ? "Możesz wejść także bez internetu."
            : mode === "cloud"
              ? "Zaloguj się tym samym loginem i PIN-em na telefonie, tablecie lub komputerze."
              : "Dane będą automatycznie zapisywane lokalnie i w SQLite."}
        </p>

        <nav className="auth-mode-switch" aria-label="Sposób logowania">
          {profiles.length ? (
            <button
              className={mode === "local" ? "active" : ""}
              onClick={() => setMode("local")}
            >
              To urządzenie
            </button>
          ) : null}
          <button
            className={mode === "cloud" ? "active" : ""}
            onClick={() => setMode("cloud")}
          >
            Mam konto
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Nowe konto
          </button>
        </nav>

        <form onSubmit={submit} className="form-stack">
          {mode === "local" ? (
            <label>
              Profil
              <select
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option value={profile.id} key={profile.id}>
                    {profile.name} · @{profile.username}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mode === "register" ? (
            <label>
              Nazwa
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Jak mamy się do Ciebie zwracać?"
                autoComplete="name"
              />
            </label>
          ) : null}
          {mode !== "local" ? (
            <label>
              Login
              <input
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value.toLowerCase())
                }
                placeholder="np. ola"
                autoComplete="username"
              />
            </label>
          ) : null}
          <label>
            PIN
            <input
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="4–10 cyfr"
              inputMode="numeric"
              type="password"
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
            />
          </label>
          {mode === "cloud" && twoFactorRequired ? (
            <label>
              Kod 2FA
              <input
                value={totp}
                onChange={(event) => setTotp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6 cyfr"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </label>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="button button-primary button-large"
            disabled={busy}
            type="submit"
          >
            {busy ? "Chwila…" : heading}
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="auth-security-note">
          <UserPlus size={15} /> Jedno konto może obsługiwać dowolną liczbę
          Twoich urządzeń.
        </p>
      </section>
    </main>
  );
}
