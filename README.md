# Focus OS

Twoja przestrzeń do nauki. Zadania, fiszki, skupienie i plan dnia w jednej
aplikacji PWA, którą uruchamiasz na własnym serwerze.

## Co potrafi

- **Pulpit nauki** — plan sesji dopasowany do dostępnego czasu i energii,
  priorytety zadań i zależności, powtórki, kalendarz dnia i rzeczywisty wykres tygodnia.
- **Skupienie** — Pomodoro, stoper, własne długości sesji, przerwy, cel sesji,
  dźwięki tła, pełny ekran i odtwarzanie timera po odświeżeniu.
  Timer pozostaje aktywny przy przechodzeniu do innych ekranów.
- **Nauka** — przedmioty, fiszki z harmonogramem FSRS, materiały, metody nauki
  z instrukcjami, generator quizów z własnych notatek, próbny egzamin i baza błędów.
- **Organizacja** — zadania z podzadaniami i powtarzalnością, projekty, rozdziały,
  planer, import/eksport ICS, nawyki, egzaminy, odznaki i wyzwania.
- **Personalizacja** — jasny, ciemny, sepia i wysoki kontrast, kolory akcentu,
  rozmiar tekstu, gęstość, własne linki, ustawienia nauki i druk planu.
- **Dane** — SQLite na serwerze, IndexedDB offline, synchronizacja urządzeń
  korzystających z tego samego serwera, rewizje i eksport konta.

W pustej instalacji `npm run setup` tworzy konto startowe **admin** z PIN-em
**1234**. Ponieważ te dane są publiczne, aplikacja wymusza zmianę PIN-u przy
pierwszym logowaniu. Kolejne konta otrzymują rolę użytkownika.

## Szybki start

Wymagania: Node.js **22 LTS (22.16 lub nowszy, ale poniżej 23)**, npm i Windows,
Linux albo macOS. Ten zakres zapewnia gotowy moduł SQLite bez lokalnej kompilacji
na typowych platformach; Node 24 na Windows może wymagać Visual Studio Build Tools.
SQLite działa lokalnie; nie instalujesz osobnego serwera bazy danych.

W katalogu projektu uruchom:

```sh
npm ci
npm run setup
npm run build
npm start
```

Otwórz [localhost:2026](http://localhost:2026), wybierz **Mam konto** i zaloguj
się jako `admin` PIN-em `1234`. Ustaw nowy PIN przed udostępnieniem serwera.

`setup` generuje dwa niezależne losowe sekrety w `.env.local` i zakłada konto
startowe tylko wtedy, gdy baza nie zawiera jeszcze użytkowników.
Nie nadpisuje istniejącej konfiguracji i nie kasuje danych.
Schemat bazy tworzy się automatycznie przy pierwszym użyciu.

Do pracy nad kodem użyj `npm run dev` zamiast build/start.
Jeśli instalacja better-sqlite3 wymaga kompilacji, zainstaluj narzędzia C/C++
oraz Python odpowiednie dla swojego systemu.

## Pierwsze kroki w nauce

1. W **Nauka → Przedmioty** dodaj swoje przedmioty.
2. W **Zadania** zapisz konkretny, mały cel, np. „Rozwiąż pięć równań”.
3. Na pulpicie wybierz czas oraz energię i przejdź do proponowanej sesji.
4. Po nauce sprawdź z pamięci, co potrafisz. Zapisz trudne pytania jako fiszki.
5. Wracaj do powtórek i sprawdzaj postęp w tygodniu.

Plan na pulpicie jest sugestią czasu pracy, nie oceną opanowania materiału.
Uwzględnia dostępne zadania i fiszki, pomija zawieszone karty i zadania z
nieukończonymi zależnościami. Przerwy dodajesz pomiędzy blokami.

## Telefon, tablet i synchronizacja

Uruchom **jeden serwer**, a na wszystkich urządzeniach otwieraj jego adres.
Na telefonie localhost oznacza telefon, nie komputer z aplikacją.
W sieci lokalnej użyj adresu komputera, np. `http://192.168.1.10:2026`.
Sprawdź reguły zapory i zaloguj to samo konto.

Dane lokalne są zapisywane w IndexedDB, a zmiany trafiają do serwera.
Diagnostyka i historia rewizji są w **Więcej → Chmura**.
Sesja HttpOnly trwa domyślnie 90 dni; F5 nie wylogowuje użytkownika.

Dla pełnej PWA na telefonie potrzebny jest **HTTPS** oraz wersja produkcyjna.
HTTP w zaufanej sieci LAN obsługuje podstawową pracę i synchronizację.
Instalacja PWA i działanie offline wymagają pierwszej udanej wizyty online.

## Konfiguracja

Przykład opisuje plik `.env.example`. Nie dodawaj `.env.local` do Git.

| Zmienna | Znaczenie |
| --- | --- |
| APP_PORT | Port lokalnego startu, domyślnie 2026; PORT ma pierwszeństwo |
| SQLITE_PATH | Plik SQLite; ścieżka względna jest liczona od katalogu projektu |
| SESSION_SECRET | Losowy sekret sesji, minimum 32 znaki |
| WORKSPACE_ENCRYPTION_KEY | Klucz szyfrowania danych; zachowaj kopię poza repozytorium |
| SESSION_TTL_DAYS | Długość sesji, domyślnie 90 dni |
| COOKIE_SECURE | Ustaw true przy publicznym HTTPS |
| APP_ORIGIN | Publiczny adres HTTPS za reverse proxy |

Nie zmieniaj klucza szyfrowania bez migracji danych. Dotychczasowe zaszyfrowane
workspace’y wymagają tego samego klucza.

## Kopie zapasowe i aktualizacja

```sh
npm run db:backup
```

Spójna kopia SQLite trafia do `backups/`. Przy włączonym WAL nie kopiuj
ręcznie samego pliku aktywnej bazy. W aplikacji dostępny jest także eksport
konta i szyfrowany eksport JSON. Przechowuj klucz serwera oddzielnie od kopii bazy.

Przed aktualizacją wykonaj backup, zatrzymaj serwer, zainstaluj zależności
przez `npm ci`, uruchom `npm run build`, potem `npm start`.
Zachowaj `.env.local`, `data/` i `backups/`.
Usunięto dawny skrypt resetowania profili; instalacja nie wymaga kasowania kont.

## Import

Fiszki: Quizlet przez skopiowany eksport tekstowy, CSV, TSV, JSON, Markdown,
TXT oraz import Anki APKG. Nie jest to automatyczna integracja z kontem Quizleta.
Obsługa multimediów i formatów APKG zależy od struktury eksportu;
aplikacja wyświetla błędy nieobsługiwanego formatu.
Eksport talii odbywa się w formatach tekstowych dostępnych w panelu.

Generator quizów działa lokalnie na regułach i definicjach z notatek.
Nie korzysta z modelu AI i nie gwarantuje poprawności wygenerowanych pytań —
przejrzyj je przed nauką.

## Docker

Utwórz `.env` z własnymi sekretami na podstawie `.env.example` i uruchom:

```sh
docker compose up -d --build
```

Kontener przechowuje SQLite w trwałym wolumenie `focus_os_data`.
Przy reverse proxy ustaw APP_ORIGIN i COOKIE_SECURE.
Nie usuwaj wolumenu podczas aktualizacji.

## Jakość i publiczny GitHub

```sh
npm run check
npm run build
npm run test:smoke
npm run release:package
```

Ostatnie polecenie tworzy **dist/focus-os-source.zip** z jawną listą
dozwolonych plików źródłowych. Wyklucza lokalne bazy, backupy, sekrety,
node_modules, build, pliki tymczasowe i nie dołącza całego katalogu roboczego.
Przed spakowaniem sprawdza, czy źródła nie zawierają lokalnych kluczy serwera.

Rozpakuj archiwum do nowego katalogu i wyślij zawartość `focus-os/` do swojego
repozytorium GitHub. Dołączone CI wykonuje kontrolę typów, lint, testy, build
i test serwera na osobnej, tymczasowej bazie (logowanie, uprawnienia, synchronizacja
dwóch urządzeń, konflikt rewizji i wylogowanie) oraz przygotowanie pakietu.
Samo przygotowanie projektu nie publikuje go w sieci.

Repozytorium źródeł może być publiczne, podczas gdy Twój serwer i dane pozostają prywatne.
GitHub Pages nie uruchomi tej aplikacji: potrzebny jest Node.js i trwały dysk SQLite.
Licencja: [MIT](LICENSE). Zasady współpracy: [CONTRIBUTING.md](CONTRIBUTING.md).
Informacje bezpieczeństwa: [SECURITY.md](SECURITY.md).

## Ograniczenia

- Powiadomienia o terminach wymagają uruchomionej aplikacji; brak serwera Web Push.
- PWA nie blokuje dowolnych stron w innych aplikacjach. „Tarcza skupienia” działa wewnątrz Focus OS.
- Dźwięki tła są generowane przez przeglądarkę; nie są nagraniami biblioteki czy deszczu.
- PIN/biometria blokują lokalny interfejs, nie szyfrują całego magazynu przeglądarki.
- Synchronizacja wymaga tego samego serwera. Dwie odrębne instalacje SQLite nie synchronizują się ze sobą.
- Aplikacja nie była poddana niezależnemu audytowi bezpieczeństwa.

## Diagnostyka

Stan serwera: [api/health](http://localhost:2026/api/health).
Przy problemach z synchronizacją sprawdź adres serwera, połączenie oraz **Więcej → Chmura**.
Przy pustym widoku po aktualizacji zamknij i otwórz aplikację; w razie potrzeby
wykonaj twarde odświeżenie. Nie czyść danych witryny przed eksportem zmian offline.
