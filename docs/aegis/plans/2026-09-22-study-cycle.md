# Focus OS: cykl przygotowań do egzaminu

## Cel i zatwierdzony zakres

Połączyć egzamin, tematy, zadania, powtórki FSRS, poprawę błędów i raporty w jeden użyteczny cykl. Użytkownik zaakceptował plan przeliczany codziennie oraz wymaga zachowania HTTP. Web Push ma działać tylko tam, gdzie przeglądarka dopuszcza bezpieczny kontekst (np. localhost); interfejs ma uczciwie wskazywać ograniczenie mobilnego HTTP. Po weryfikacji należy zaktualizować publiczne repozytorium `kappelo/focus-os` bez danych lokalnych.

## Architektura i granice

- Next.js 16, React 19, SQLite, istniejący `WorkspaceState` synchronizowany przez `/api/sync`.
- Plan egzaminacyjny jest deterministyczną projekcją `exams`, `tasks`, `flashcards`, `subjects`, `projects` i kalendarza. Nie tworzy automatycznie duplikatów zadań. Ukończenie tematu jest jawnie zapisane w rekordzie egzaminu.
- Sesja błędów aktualizuje istniejące `mistakes`; ręczna samoocena następuje po pokazaniu odpowiedzi, ponieważ wolny tekst może być poprawny mimo innego brzmienia.
- Raporty obliczane są z istniejących sesji, prób quizowych, zadań i kart; brak danych nie jest przedstawiany jako wynik zero wiedzy.
- Web Push używa osobnych subskrypcji przypisanych do konta, kluczy VAPID tylko na serwerze, harmonogramu serwerowego i deduplikacji wysyłek. Bez publicznego HTTPS mobilne HTTP nie obsłuży subskrypcji.
- Brak usuwania ani migracji istniejących rekordów użytkownika. Zmiany formatu są opcjonalne i odczyt starych workspace'ów pozostaje zgodny.

## TDD i weryfikacja

TDD Route: mode `off`, decision `skipped`; testy regresji i integracyjne po zmianach. Testy czystych funkcji obejmą pominięty dzień, termin egzaminu, zaległe karty, brak danych, błędy i raporty. `npm run check`, `npm run build`, `npm run test:smoke`; Web Push sprawdzony także w scenariuszu braku bezpiecznego kontekstu. Publikacja dopiero po kontroli sekretów i odczycie diffu.

## Zadania

1. **Plan egzaminu.** `src/lib/types.ts`, `src/lib/exam-plan.ts`, testy, `src/components/exam-plan.tsx`, `src/components/views/more-view.tsx`. Dodać opcjonalny budżet i jawne ukończenie tematów, projektować dni od dziś do terminu, rozłożyć niedokończone tematy i zadania, pokazać należne powtórki i przeliczyć po pominięciu dnia. Nie nadpisywać kalendarza automatycznie.
2. **Sesja błędów.** `src/components/study-toolkit.tsx`, pomocnicze funkcje i testy. Krótka kolejka z aktywnych błędów, odpowiedź użytkownika, ujawnienie wzorca, samoocena, kolejny termin, konwersja do fiszki bez duplikatu.
3. **Raporty.** `src/lib/study-insights.ts`, testy, `src/components/study-insights.tsx`, `src/components/views/more-view.tsx`. Porównać planowany i rzeczywisty czas ukończonych zadań, podać konserwatywną sugestię szacowania; osobno pokazać dane przedmiotu z sesji, quizów, fiszek i błędów.
4. **Web Push.** `src/lib/db.ts`, `src/app/api/push/*`, `src/lib/push-server.ts`, `scripts/push-worker.mjs`, `scripts/start.mjs`, `src/components/notification-center.tsx`, `public/sw.js`, konfiguracja i testy. Subskrypcje per użytkownik, bezpieczna walidacja endpointów, harmonogram i idempotentna wysyłka. Nie obiecywać działania po zamknięciu PWA przez LAN HTTP.
5. **Dokumentacja, bezpieczeństwo i publikacja.** README, `.env.example`, pakiet publiczny. Potwierdzić, że brak `.env.local`, SQLite, kopii, PIN-ów/sekretów z lokalnego hosta. Aktualizacja `kappelo/focus-os` po pełnej weryfikacji.

## Punkty kontrolne

- Po każdym zadaniu: test celowy, sprawdzenie odniesień do starych pól, ocena zgodności synchronizacji.
- Koniec: świeży komplet testów, build, test serwera, weryfikacja interfejsu mobilnego i HTTP, kontrola pakietu oraz potwierdzenie opublikowanego commita.
