# Гід: Стяг незламних

Незалежний інформаційний гід для ветеранів і ветеранок війни, людей з інвалідністю внаслідок війни та їхніх родин. Загальноукраїнські порядки доповнюють контакти й можливості Одещини. Гід доступний як PWA та [мобільний застосунок](mobile/README.md).

## Документація проєкту

| Документ | Що в ньому |
| --- | --- |
| [Мобільний застосунок](mobile/README.md) | Локальний запуск iOS та Android, нативні вкладки й перевірки на пристрої |
| [Випуск у магазинах](docs/store-release.md) | Стан подання iOS, TestFlight, скриншоти, підпис і підготовка Google Play |
| [Джерела та оновлення каталогу](docs/official-sources.md) | Першоджерела, дати звірки й порядок внесення змін |
| [Дизайн-система й типографіка](docs/typography.md) | Спільні правила компонентів, кольорів, відступів і текстових стилів вебверсії та мобільного застосунку |
| [Дослідження першого прототипу](docs/research-and-style-pack.md) | Історичні референси й початкові гіпотези |

## Як побудовано гід

Картка маршруту пояснює, з чого почати, куди звернутися, які документи підготувати та що робити в поширених ситуаціях. Пояснення викладено українською своїми словами на основі офіційних матеріалів. Наприкінці картки можна розгорнути «Джерела й перевірка», щоб відкрити першоджерела й побачити дати звірки.

У гіді 14 маршрутів, серед них «Після поранення», «Психологічна підтримка», «Сімʼї загиблих» і «Сімʼї безвісти зниклих». Запит «МСЕК» знаходить чинний маршрут оцінювання повсякденного функціонування.

PWA читає [спільний каталог](catalog.js) напряму. Мобільна збірка містить [знімок цього каталогу](mobile/src/data/catalog.json). Пошук і підбір маршрутів обидві версії виконують за допомогою [спільної логіки](mobile/src/search.js). Установа, що приймає заяву, розглядає конкретну справу та ухвалює рішення.

## Запуск

PWA і service worker працюють через HTTPS або локально через localhost. У корені проєкту запустіть локальний сервер на Node.js 20+:

    node server.cjs

Потім відкрийте http://localhost:4173. Після першого завантаження оболонка, шрифти й довідковий каталог доступні офлайн. Посилання на зовнішні установи потребують інтернету.

### Cloudflare Workers

Щоб оновити [вебверсію гіда](https://nezlamnyi.eerinessbusiness.workers.dev/) і сторінки підтримки та конфіденційності, запустіть `npx wrangler deploy` з кореня проєкту. [Конфігурація Workers](wrangler.toml) розгортає статичні файли за [списком дозволених ресурсів](.assetsignore). Публічна PWA використовує локальний каталог. Після змін у ресурсах офлайн звірте список `APP_FILES` та оновіть версію кешу в [service worker](sw.js). Публічні сторінки мобільного застосунку відкриваються без входу. [Підтримка](https://nezlamnyi.eerinessbusiness.workers.dev/support.html) · [Конфіденційність](https://nezlamnyi.eerinessbusiness.workers.dev/privacy.html)

### На початковому екрані телефона

Відкрийте адресу застосунку через HTTPS на телефоні.

- **iPhone:** у Safari виберіть «Поширити» → «На Початковий екран». Увімкніть «Відкрити як вебпрограму», якщо є такий перемикач, і торкніться «Додати». [Інструкція Apple](https://support.apple.com/en-hk/guide/iphone/iphea86e5236/ios)
- **Android:** у Chrome виберіть «Встановити застосунок» у меню браузера або «Установити застосунок» у меню гіда, коли доступна ця кнопка. [Встановлення PWA в Chrome](https://web.dev/learn/pwa/installation-prompt/)

Перший раз відкрийте застосунок з іконки з увімкненим інтернетом, щоб завантажити каталог для роботи офлайн.

## Що доступно у вебверсії

- Головний екран, каталог послуг, «Характерник», контакти в Одеській області та меню.
- Пошук за назвами, ключовими словами й текстом маршрутів. Контакти можна шукати за містом або громадою.
- Картки містять покрокові інструкції, списки документів, пояснення та за потреби прямий дзвінок до установи.
- Маршрут можна зберегти з картки або відповіді «Характерника» і відкрити через «Меню» → «Мої маршрути». Видно прогрес і наступний пункт. Закладки й відмітки в чек-листах зберігаються в браузері та доступні офлайн після першого завантаження.

У мобільній версії п’ята вкладка називається «Про гід». Закладки та відмітки зберігаються окремо від PWA і доступні в картках маршрутів. [Мобільний застосунок](mobile/README.md)

## Характерник

«Характерник» підбирає конкретну відповідь із вбудованого каталогу, пам’ятає контекст короткого уточнення й відкриває потрібний розділ маршруту. Якщо даних бракує, він пропонує уточнити питання або дає контакт обласної лінії.

Для веб-режиму передайте серверу `OPENAI_API_KEY`, відкрийте http://127.0.0.1:4173 і ввімкніть «Онлайн-помічник». Сервер слухає loopback. Для доступу через HTTPS потрібен захищений проксі до цього сервера. Для браузера додайте адресу сайту в `APP_ORIGIN` і проксіюйте API з того самого origin. Для розробки мобільного застосунку задайте `EXPO_PUBLIC_ASSISTANT_URL` як повну HTTPS-адресу `/api/assistant`. У збірках для App Store та Google Play пошук і підбір відповідей відбуваються на пристрої. На публічному проксі встановіть обмеження запитів і доступу до API. Ключ зберігається тільки на сервері.

Якщо користувач вмикає онлайн-режим, налаштований сервер отримує поточне запитання й ідентифікатор попередньої теми. Модель повертає ідентифікатори перевірених розділів. Тексти, числа, контакти та URL надходять із каталогу. За помилки або втрати зв’язку працює локальна відповідь. Історія зберігається в пам’яті поточного сеансу. [OpenAI Docs · Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

### Локальна модель для iPhone Simulator

Запустіть [llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) із [Qwen3-1.7B GGUF](https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF). Для локальної перевірки ключ OpenAI не потрібен.

```sh
llama-server --model /path/to/Qwen3-1.7B-Q4_K_M.gguf --host 127.0.0.1 --port 4376 --ctx-size 6144 --parallel 1 --jinja --cors-origins localhost --no-webui
PORT=4175 ASSISTANT_LLAMA_URL=http://127.0.0.1:4376/v1/chat/completions node server.cjs
```

Під час запуску збірки для розробки на iPhone Simulator задайте `EXPO_PUBLIC_ASSISTANT_URL=http://127.0.0.1:4175/api/assistant` і ввімкніть «Онлайн-помічник» у застосунку. Позначка над відповіддю показує, чи розділ підібрала модель. Локальну HTTP-адресу використовують для симулятора. На фізичному пристрої потрібна доступна HTTPS-адреса сервера.

## Матеріали

Маршрути спираються на офіційні джерела. Посилання на них є в картках послуг і контактів. Перелік і дати звірки доступні в картках і [каталозі джерел](catalog.js).

Ілюстрацію [«Міст на Одещині»](assets/assistant-coast-wide.webp) створено вбудованим ImageGen для екрана «Характерник».

<!-- ImageGen prompt: Use case: illustration-story. Create one wide 3:2 original quiet editorial background illustration for the Ukrainian veteran services app Незламний. A low sweeping pedestrian bridge across the Odesa coastline, a continuous accessible ramp, tiny civilian silhouettes walking and a person in a wheelchair moving independently toward the same destination. A lighthouse on the far shore. Modern linocut / architectural screen print, layered clean organic silhouettes, subtle paper grain, restrained flat muted teal and sage on an almost uniform deep blue-green #243a47 field. Strong graphic silhouette, calm, dignified, no uniforms, no weapons, no insignia. Keep visual interest mainly on the right half; left half dark and very quiet for an HTML title overlay. Art must work as subtle background texture, especially visible in upper right. No text, no symbols resembling text, no watermark. -->

<!-- ImageGen edit prompt: Keep the lighthouse and bridge in place. Extend a short, tapering rocky breakwater, low-contrast reflections and faint cloud wisps left from the lighthouse. Fade the new detail into the existing teal; keep the bottom left quiet for text. Preserve the framing, palette and lighting. -->
