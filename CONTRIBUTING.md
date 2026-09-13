# Współtworzenie Focus OS

Wymagany Node.js 22.16+ i npm. Uruchom `npm ci`, `npm run setup`, `npm run dev`.
Każda instalacja tworzy własne konto w przeglądarce; repozytorium nie zawiera danych demonstracyjnych ani haseł.

Przed pull requestem uruchom `npm run check` i `npm run build`.
Zmiany interfejsu sprawdź przy szerokości 360, 768 i 1440 px, w jasnym i ciemnym motywie oraz przy dużej czcionce.
Sprawdź obsługę klawiatury, długie polskie nazwy i pusty stan.

Zmiany algorytmów powinny mieć test regresji. Zmiany schematu wymagają migracji
zachowującej istniejące dane; nie kasuj bazy w ramach instalacji.

Nigdy nie dodawaj do PR plików środowiskowych, baz, kopii konta i zrzutów z prywatnymi informacjami.
Do udostępnienia czystych źródeł służy `npm run release:package`.
