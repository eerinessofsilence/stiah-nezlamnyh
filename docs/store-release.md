# Перший випуск у App Store і Google Play

## Стан випуску

| Платформа | Що підтверджено | Наступний крок |
| --- | --- | --- |
| iOS | У [поданні App Store Connect](https://appstoreconnect.apple.com/apps/6837277648/distribution/reviewsubmissions/details/18f1b39a-fc84-472e-85c5-6d72c2f258de) версія `0.4.0` зі збіркою `4` має статус **Rejected**. App Review просить додаткові відомості й запис екрана за Guideline 2.1. | Перевірити збірку на iPhone, додати запис та оновити **App Review Notes**, після чого повторно подати збірку. |
| Android | Є локальний APK з тестовим підписом та непідписаний AAB для `arm64-v8a`. Завантаження в Play Console не підтверджено. | Підготувати ключ завантаження, підписати AAB, додати Android-скриншоти й заповнити картку та декларації. |

## Дані карток

| Поле | Значення |
| --- | --- |
| Назва | Гід: Стяг незламних |
| Основна мова | Українська |
| Ідентифікатор iOS і пакет Android | `app.stiahnezlamnykh.guide` |
| SKU App Store Connect | `STIAH-GUIDE-IOS` |
| Apple ID | [6837277648](https://appstoreconnect.apple.com/apps/6837277648/distribution/ios/version/inflight) |
| Цільова версія iOS | `0.6.0`, збірка `6` |
| Цільова версія Android | `0.6.0`, `versionCode` `3` |
| Ціна | Безкоштовно |
| Категорія | Reference в App Store, Books & Reference у Google Play |
| Доступність першого випуску в App Store | Лише Україна |
| Віковий рейтинг, розрахований Apple | 13+ |
| URL політики | [Політика конфіденційності](https://nezlamnyi.eerinessbusiness.workers.dev/privacy.html) |
| URL підтримки | [Підтримка](https://nezlamnyi.eerinessbusiness.workers.dev/support.html) |
| Публічна пошта підтримки | `stiah.guide@gmail.com` |
| App Store copyright | `2026 Hubanov Oleksandr` |
| App Store subtitle | Підтримка та послуги |
| App Store keywords | ветерани,ветеранки,УБД,Одещина,пільги,реабілітація |
| Google Play short description | Офлайн-гід: послуги для ветеранів і родин, документи та контакти Одещини. |

У картці Apple збережено контакт і нотатки для App Review. Вхід у застосунок не потрібен. Декларація **Data Not Collected** опублікована. Для збірки вказано **App Uses Non-Exempt Encryption: No**. Після схвалення власник випускає версію вручну. Доступність на Mac з Apple Silicon та Apple Vision Pro вимкнено.

Для наступного завантаження в TestFlight у коді задано `0.6.0`, збірку `6`. За останньою звіркою, збірка `0.4.0 (4)` доступна в TestFlight і прикріплена до картки App Store `0.4.0`.

У **App Compliance** збережено статус DSA **non-trader**. Запуск лише в Україні. Пункти **Security Assessment** і **AI Generated or Synthetic Content** стосуються материкового Китаю, який не вибрано в доступності.

### Опис картки

«Стяг незламних» — незалежний інформаційний гід для ветеранів і ветеранок, осіб з інвалідністю внаслідок війни та їхніх родин. Знайдіть, з чого почати, які документи підготувати і куди звернутися.

- Покрокові маршрути про документи, пільги, реабілітацію, психологічну підтримку та інші теми.
- Контакти служб і ветеранських просторів в Одеській області.
- Пошук у каталозі, чек-листи та помічник «Характерник», який підбирає розділи гіда на пристрої.
- Маршрути й контакти доступні офлайн. Для відкриття зовнішніх сайтів потрібен інтернет.

Гід не є державним застосунком, не представляє органи влади та не приймає заяв. До карток додано посилання на офіційні джерела, зокрема Мінветеранів (https://mva.gov.ua/) і портал «Законодавство України» (https://zakon.rada.gov.ua/).

Матеріали про здоров’я пояснюють, куди звернутися по допомогу. Застосунок не є медичним виробом, не діагностує, не лікує, не виліковує й не запобігає захворюванням. З медичних питань звертайтеся до кваліфікованого медичного фахівця.

### App Review Notes

Перед збереженням нотаток підставте посилання на запис, який відкривається без входу. Використовуйте збірку, вибрану для повторного подання.

```text
Guideline 2.1 — Review information for iOS 0.6.0 (build 6)

Screen recording on a physical iPhone: [VIDEO LINK]

Purpose and audience: “Гід: Стяг незламних” is a free, independent Ukrainian-language guide for Ukrainian veterans, people with war-related disabilities, and their families. It helps them find the next step, prepare documents and find the responsible agency or local support contact.

How to test:
1. Launch the app to open “Головна” (Home). The app has no accounts, paid features, or shared user content. No demo credentials or sample files are required.
2. On “Головна”, tap “Ветеран” (Veteran), search for “УБД”, and open “Статус і документи” (Status and documents). In “Як отримати УБД”, mark an item under “Що підготувати” (What to prepare). The check mark saves automatically. Expand “Джерела й перевірка” at the bottom to see official sources.
3. Open “Помічник” (Assistant) and tap “Які документи потрібні для УБД?” to see how the assistant finds a relevant guide. In “Меню” (Menu), open “Контакти” (Contacts), type “Ізма”, and view the Izmail community contact.

External services: The catalog, search, assistant and saved progress use bundled data and on-device storage. Core features work offline. The News tab retrieves public headlines and images directly from mva.gov.ua and saves the latest headlines, dates and links on the device. The App Store build uses no project backend, authentication provider, payment processor or external AI service. Cloudflare hosts the support and privacy pages. Users can choose to open public sources in the system browser.

Regional availability: The app is distributed in Ukraine. National procedures are available throughout Ukraine, with additional contacts for Odesa Oblast. Features and content are the same for all users regardless of their location.

Content and rights: The app is an independent reference guide with links to public sources from Ukrainian authorities, including the Ministry of Veterans Affairs and Ukraine’s legislation portal. The app does not represent a government agency, accept applications, or provide medical care or individualized legal advice. Font attribution and license information are on the support page.

Privacy (English summary): https://nezlamnyi.eerinessbusiness.workers.dev/privacy.html#english
Support: https://nezlamnyi.eerinessbusiness.workers.dev/support.html
```

### Запис для App Review і повторне подання

1. Встановіть збірку `0.6.0 (6)` з TestFlight на фізичний iPhone з актуальною версією iOS. Перед записом перевірте сценарій із нотаток, запуск без мережі та збереження відмітки після перезапуску. З інтернетом відкрийте посилання на джерело, підтримку та політику конфіденційності.
2. На чистому встановленні почніть запис із домашнього екрана iPhone й відкрийте гід. Покажіть перший запуск, вибір статусу, пошук і картку з чек-листом та джерелами, відповідь «Характерника» й пошук контакту. Додайте посилання на відео до нотаток і перевірте його у приватному вікні браузера.
3. У [поданні із зауваженням](https://appstoreconnect.apple.com/apps/6837277648/distribution/reviewsubmissions/details/18f1b39a-fc84-472e-85c5-6d72c2f258de) виберіть **Edit** біля версії. Вказана в картці версія App Store має бути `0.6.0`. У секції **Build** виберіть збірку `6` і звірте скриншоти з цією збіркою. Збережіть **App Review Information → Notes**, натисніть **Add for Review** і завершіть подання через **Resubmit to App Review**. [Вибір збірки](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/) · [Кроки повторного подання](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/manage-a-submission-with-unresolved-issues)

## Публічні сторінки та перевірка Release

Cloudflare обслуговує [сторінку підтримки](../support.html), [політику конфіденційності](../privacy.html) та їхній [спільний CSS](../store-info.css). Після змін виконайте `npx wrangler deploy` з кореня проєкту. Відкрийте обидві адреси з таблиці без входу й перевірте контакт підтримки, перехід між сторінками та англомовне резюме політики. Для метаданих магазину використовуйте зазначені прямі URL.

Під час збирання задайте `EXPO_PUBLIC_GUIDE_SITE_URL=https://nezlamnyi.eerinessbusiness.workers.dev`. У фінальній збірці перевірте обидва посилання з «Меню» → «Про гід», перший запуск без мережі, пошук «УБД», «Помічник» і контакти. Решта сценаріїв є в [мобільному README](../mobile/README.md#перевірка-на-пристрої).

Відповіді в App Privacy та Data safety мають відповідати фактичному складу й поведінці збірки. Політика пояснює, які дані лишаються на пристрої і що обробляється, коли користувач відкриває публічну сторінку чи пише до підтримки. Release використовує локальний каталог і не активує `EXPO_PUBLIC_ASSISTANT_URL`. Якщо змінюються SDK чи мережева поведінка, звірте політику, декларації магазинів, зведений Privacy Manifest у Xcode та дозволи Android. [Вимоги Apple](https://developer.apple.com/app-store/review/guidelines/#privacy) · [Вимоги Google Play](https://support.google.com/googleplay/android-developer/answer/10144311)

## iOS

### Збірка через EAS

З кореня проєкту виконайте команду. Під час першого запуску EAS запропонує прив’язати проєкт Expo й налаштувати підпис та доступ до App Store Connect. Після збирання EAS завантажить збірку в TestFlight. [Автоматичне завантаження через EAS](https://docs.expo.dev/build/automate-submissions/)

```sh
cd mobile && npx eas-cli@latest build --platform ios --profile testflight --auto-submit
```

### Архів і TestFlight

1. Для наступної збірки відкрийте [Styagnezlamnih.xcworkspace](../mobile/ios/Styagnezlamnih.xcworkspace) у Xcode 26.4 або новішому. Виберіть команду Apple Developer для `app.stiahnezlamnykh.guide` у **Signing & Capabilities**. Для повторного завантаження цієї версії збільште номер збірки.
2. Виберіть ціль для фізичного iOS-пристрою та виконайте **Product → Archive**. В Organizer виберіть **Distribute App → App Store Connect** або **TestFlight & App Store**, якщо Xcode показує такий варіант. Завантажена збірка має дозволяти подання в App Store. [Розповсюдження збірок у Xcode](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
3. Після обробки додайте збірку до групи **Test** у TestFlight. Внутрішній тестер має бути користувачем App Store Connect з доступом до застосунку та придатною роллю. Він приймає запрошення і встановлює збірку через TestFlight. [Внутрішні тестери](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)

### Скриншоти

П’ять зображень у [каталозі скриншотів](store-assets/ios) замінено на знімки актуального інтерфейсу на симуляторі iPhone 13. Їхній розмір змінено з 1170 × 2532 px на підтримуваний App Store Connect розмір **1179 × 2556 px** і завантажено до картки `0.4.0` у групу **iPhone with Dynamic Island (medium display)**.

| Файл | Екран |
| --- | --- |
| [01-home.png](store-assets/ios/01-home.png) | Головна |
| [02-services.png](store-assets/ios/02-services.png) | Каталог послуг |
| [03-route.png](store-assets/ios/03-route.png) | Картка маршруту |
| [04-assistant.png](store-assets/ios/04-assistant.png) | Помічник |
| [05-contacts.png](store-assets/ios/05-contacts.png) | Контакти |

На сторінці версії `0.4.0` підтверджено групу **iPhone with Dynamic Island (medium display)**; актуальний великий формат окремо не підтверджено. Для нових наборів використовуйте розміри, які показує App Store Connect для відповідної групи дисплеїв. [Специфікації Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

### Подання та випуск

1. У [картці версії](https://appstoreconnect.apple.com/apps/6837277648/distribution/ios/version/inflight) звірте її номер із версією вибраної збірки та натисніть **Add for Review**. Цей крок створює чернетку подання зі статусом **Ready for Review**.
2. Перевірте чернетку та натисніть **Submit for Review**. Далі відстежуйте статус у розділі **App Review**. [Порядок подання Apple](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/)
3. Після схвалення дочекайтеся **Pending Developer Release** і запустіть випуск з картки версії.

## Android і Google Play

### APK для пристрою

Локальний файл `mobile/android/app/build/outputs/apk/release/app-release.apk` має тестовий підпис Android Debug. Його можна використати для локального встановлення, якщо пристрій підтримує ABI збірки й на ньому немає копії з несумісним підписом. Для перевірки новішого коду зберіть новий APK.

```sh
adb install -r mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Підпис і підготовка Play Console

1. Підготуйте ключ завантаження поза вихідним кодом. Передайте всі чотири змінні через захищене середовище: `STIAH_UPLOAD_KEYSTORE` (абсолютний шлях), `STIAH_UPLOAD_STORE_PASSWORD`, `STIAH_UPLOAD_KEY_ALIAS`, `STIAH_UPLOAD_KEY_PASSWORD`.
2. У `mobile/android` виконайте `./gradlew :app:bundleRelease`. Вихідний файл — `app/build/outputs/bundle/release/app-release.aab`. Без цих змінних Release лишається непідписаним. Для нового завантаження після вже прийнятої збірки збільште `versionCode`. Перед підписом перевірте цільовий API, підтримувані ABI й [сумісність зі сторінками пам’яті 16 КБ](https://developer.android.com/guide/practices/page-sizes).
3. Для картки є [іконка 512 × 512](store-assets/google-play-icon.png) і [банер 1024 × 500](store-assets/google-play-feature.png). Зніміть окремі [скриншоти Android](https://support.google.com/googleplay/android-developer/answer/9866151). Заповніть Data safety, декларації про здоров’я та державну інформацію, рейтинг, цільову аудиторію, рекламу й доступ до застосунку.
4. Для особистих акаунтів, створених після 13.11.2023, Google вимагає щонайменше 12 тестерів, які безперервно беруть участь у закритому тесті протягом 14 днів. Після цього подайте запит на доступ до Production. [Вимоги Google Play](https://support.google.com/googleplay/android-developer/answer/14151465)
