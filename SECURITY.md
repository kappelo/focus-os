# Bezpieczeństwo

Nie publikuj danych logowania, backupów ani opisów podatności zawierających prywatne dane w publicznych issues.
Użyj prywatnego zgłoszenia Security Advisory w repozytorium, jeśli właściciel je udostępnił.

Focus OS jest aplikacją self-hosted. `npm run setup` tworzy w pustej bazie konto
`admin` z jednorazowym PIN-em `1234`. Aplikacja wymusza jego zmianę przy pierwszym
logowaniu. Nigdy nie udostępniaj serwera przed zmianą tego PIN-u.

Publiczny dostęp wymaga HTTPS, COOKIE_SECURE=true i APP_ORIGIN.
Zachowaj SESSION_SECRET oraz WORKSPACE_ENCRYPTION_KEY poza repozytorium;
utrata klucza szyfrowania oznacza brak możliwości odczytania zaszyfrowanych danych.
PIN 4–10 cyfr nie zastępuje silnego hasła przy nieograniczonym dostępie publicznym:
używaj 2FA i ograniczenia dostępu do własnego serwera.

IndexedDB przechowuje lokalną kopię danych na urządzeniu. Blokada aplikacji
chroni interfejs, nie szyfruje całego profilu przeglądarki. Używaj własnego konta systemowego.
