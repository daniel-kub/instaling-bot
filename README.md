# instaling-bot
Bot dla automatycznego rozwiązywania sesji na instaling.pl.

> **Uwaga!** Od 06.07.2026 InstaLing wykrywa automatyzację i może blokować konta.
> Korzystasz z bota na własną odpowiedzialność. Ten bot stara się zachowywać
> jak człowiek (prawdziwa przeglądarka Chrome, realistyczne opóźnienia, losowe
> odpowiedzi), ale to **nie gwarantuje** niewykrywalności.

Wymaga Node.js 18+ i połączenia z internetem. Przy pierwszym `npm install`
puppeteer pobierze własną wersję Chrome (~150 MB).

# Instalacja
1. Zainstaluj Node.js 18+ (https://nodejs.org/) i w tym katalogu uruchom:
   ```
   npm install
   ```
   (Jeśli npm 11+ zapyta o instalacyjny skrypt puppeteera - zaakceptuj go,
   potrzebny do pobrania przeglądarki. Ewentualnie: `npx puppeteer browsers install chrome`)
2. W pliku `config/Config.json` w polu `login` wpisz **login ucznia**, a w polu `password` jego hasło.
3. Uruchom:
   ```
   npm run start
   ```

# Sposób działania
- **Logowanie** odbywa się przez prawdziwą przeglądarkę Chrome (puppeteer) na
  `instaling.pl`, tak jakby robił to człowiek.
- Po zalogowaniu bot wyciąga z adresu strony `student_id` i wykonuje sesję
  tymi samymi endpointami, których używa nowa aplikacja sesji
  (`https://instaling.pl/app/session/server/actions/init_session.php`,
  `generate_next_word.php`, `save_answer.php`), wysyłając zapytania z wnętrza
  zalogowanej strony (fetch w kontekście przeglądarki). Stare endpointy
  (`/ling2/server/actions/...`) nie działają od 2026 (HTTP 405).
- `generate_next_word` celowo nie podaje angielskiego słówka - zwraca tylko
  polskie tłumaczenie i zdanie z luką. Prawidłowe odpowiedzi (angielskie
  słówka) bot bierze z listy `getWordsToRepeat`, dopasowując po `word_id`.
  - `valid_chance` (`1` = 100%) kontroluje, ile odpowiedzi ma być poprawnych.
    Przy błędnej odpowiedzi bot wysyła tłumaczenie innego słówka z sesji.
- Nowe słówka są dopisywane do `config/SavedWords.json` (tłumaczenie, angielski
  odpowiednik oraz przykładowe zdanie).
- Po zakończeniu sesji bot zapisuje słówka i zamyka przeglądarkę.

# Objaśnienie configu (`config/Config.json`)
- `login` / `password` - dane logowania **ucznia** (konto ucznia, nie nauczyciela)
- `sites.login` - strona logowania (domyślnie `https://instaling.pl/teacher.php?page=login`)
- `delays` - czasy oczekiwania w milisekundach, bot losuje między min a max:
  - `click_min`/`click_max` - po kliknięciu w przycisk
  - `type_min`/`type_max` - między wciśnięciami klawiszy przy wpisywaniu
  - `selector` - maksymalny czas oczekiwania na element strony
  - `next_word_min`/`next_word_max` - odstęp między słówkami
- `valid_chance` - część odpowiedzi poprawnych (`1` = 100%, `0.85` = 85%...)
- `answer_with` - czy odpowiadamy `english` (po polsku, wpisujemy angielskie słówko) czy `polish` (po angielsku, wpisujemy polskie tłumaczenie). Jeśli nie wiesz, zostaw `english`.
- `show_browser` - `true`: widoczna przeglądarka, `false`: ukryta (tryb headless)
- `open_devtools` - otwiera DevTools (wymusza `show_browser: true`)
- `mute_audio` - wycisza dźwięk przeglądarki
- `debug` - dodatkowe logi z przeglądarki (nie idą przez webhook)
- `webhook` - opcjonalny URL webhooka Discorda; logi będą też tam wysyłane

# Znane ograniczenia
- Bot jest przeznaczony do kont **ucznia** i wymaga aktywnej przydzielonej sesji.
- Mapowanie pól odpowiedzi z `getWordsToRepeat` (`word`/`answer`/`translation`)
  jest sprawdzane pod każdym z tych kluczy. Jeśli odpowiedzi będą błędne po
  zmianie API przez InstaLing, patrz funkcja `normalizeWordsToRepeat` w `src/main.js`.
- Folder `uBlock_Origin_1.34.0_0` jest nieużywany (przeglądarki z 2026 nie
  wspierają rozszerzeń Manifest V2). Reklamy i trackery są blokowane przez
  `setRequestInterception` w `src/main.js` (`blockedHosts`).