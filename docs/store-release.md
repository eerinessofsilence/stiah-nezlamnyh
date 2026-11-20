# Перший випуск у App Store і Google Play

## Стан випуску

| Платформа | Що підтверджено | Наступний крок |
| --- | --- | --- |
| iOS | Станом на 20.11.2026 [версія 0.1.0](https://appstoreconnect.apple.com/apps/6837277648/distribution/ios/version/inflight) має статус **Prepare for Submission**. Підписана збірка `1` прикріплена до версії та доступна в TestFlight. | Вибрати фінальну збірку, звірити набір скриншотів для великого дисплея iPhone, пройти **Add for Review → Submit for Review**. |
| Android | Є локальний APK з тестовим підписом та непідписаний AAB для `arm64-v8a`. Завантаження в Play Console не підтверджено. | Підготувати ключ завантаження, підписати AAB, додати Android-скриншоти й заповнити картку та декларації. |

## Дані карток

| Поле | Значення |
| --- | --- |
| Назва | Гід: Стяг незламних |
| Основна мова | Українська |
| Ідентифікатор iOS і пакет Android | `app.stiahnezlamnykh.guide` |
| SKU App Store Connect | `STIAH-GUIDE-IOS` |
| Apple ID | [6837277648](https://appstoreconnect.apple.com/apps/6837277648/distribution/ios/version/inflight) |
| Версія і номер збірки | `0.1.0`, збірка `1` |
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

У поточному коді є зміни після архівування збірки `1`, зокрема перемикач «Темна тема» на екрані «Про гід». Щоб включити їх у перший випуск, підготуйте новий Release-архів із більшим номером збірки, перевірте його через TestFlight і виберіть у версії `0.1.0`.

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

This Ukrainian-language app is an independent reference guide for veterans and their families. It is not affiliated with government agencies and does not provide medical services or process applications. No sign-in, payment, demo account, or server access is required. From Home, search for “УБД”, open a route, and expand “Джерела й перевірка” at the bottom to see official sources. The Services tab includes checklists, and the Contacts tab can search by community. “Помічник” matches questions against the bundled catalogue on-device. “Про гід” contains the privacy policy and support links. The guide and local search work offline. Opening an external website, email app, or dialer is initiated by the user.

## Публічні сторінки та перевірка Release

Після змін у [support.html](../support.html) або [privacy.html](../privacy.html) виконайте `npx wrangler deploy` з кореня проєкту. Відкрийте обидві публічні адреси без входу й перевірте контакт підтримки. Задайте `EXPO_PUBLIC_GUIDE_SITE_URL` як базову HTTPS-адресу в середовищі збирання JS. У фінальній збірці перевірте обидва посилання з «Про гід», перший запуск без мережі, пошук «УБД», «Помічник» і контакти. Решта сценаріїв є в [мобільному README](../mobile/README.md#перевірка-на-пристрої).

Відповіді в App Privacy та Data safety мають відповідати фактичному складу й поведінці збірки. Release використовує локальний каталог і не активує `EXPO_PUBLIC_ASSISTANT_URL`. Перед випуском зі змінами в SDK або мережевій поведінці перевірте зведений Privacy Manifest у Xcode та дозволи Android.

## iOS

### Архів і TestFlight

1. Для наступної збірки відкрийте [Styagnezlamnih.xcworkspace](../mobile/ios/Styagnezlamnih.xcworkspace) у Xcode 26.4 або новішому. Виберіть команду Apple Developer для `app.stiahnezlamnykh.guide` у **Signing & Capabilities**. Для повторного завантаження цієї версії збільште номер збірки.
2. Виберіть ціль для фізичного iOS-пристрою та виконайте **Product → Archive**. В Organizer виберіть **Distribute App → App Store Connect** або **TestFlight & App Store**, якщо Xcode показує такий варіант. Завантажена збірка має дозволяти подання в App Store. [Розповсюдження збірок у Xcode](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
3. Після обробки додайте збірку до групи **Test** у TestFlight. Внутрішній тестер має бути користувачем App Store Connect з доступом до застосунку та придатною роллю. Він приймає запрошення і встановлює збірку через TestFlight. [Внутрішні тестери](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/)

### Скриншоти

[П’ять промоскриншотів](store-assets/ios) розміром **1179 × 2556 px** завантажено до групи **iPhone with Dynamic Island (medium display)**. Вони показують різні екрани гіда. [Попередній перегляд набору](store-assets/ios-preview.jpg)

| Файл | Екран |
| --- | --- |
| [01-home.png](store-assets/ios/01-home.png) | Головна |
| [02-services.png](store-assets/ios/02-services.png) | Каталог послуг |
| [03-route.png](store-assets/ios/03-route.png) | Картка маршруту |
| [04-assistant.png](store-assets/ios/04-assistant.png) | Помічник |
| [05-contacts.png](store-assets/ios/05-contacts.png) | Контакти |

Перед поданням перевірте в медіаменеджері наявність скриншотів для **iPhone with Dynamic Island (large display)** або **iPhone with Face ID (large display)**. Це окрема вимога від уже завантаженого середнього формату. Для великого Dynamic Island підійде iPhone 14 Pro Max з розміром **1290 × 2796 px**. Використовуйте зображення реальних екранів із версії, яку подаєте. [Специфікації Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

### Подання та випуск

1. У [версії 0.1.0](https://appstoreconnect.apple.com/apps/6837277648/distribution/ios/version/inflight) перевірте вибрану збірку і натисніть **Add for Review**. Цей крок створює чернетку подання зі статусом **Ready for Review**.
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
3. Для картки є [іконка 512 × 512](../assets/icon-512.png) і [банер 1024 × 500](store-assets/google-play-feature.png). Зніміть окремі [скриншоти Android](https://support.google.com/googleplay/android-developer/answer/9866151). Заповніть Data safety, декларації про здоров’я та державну інформацію, рейтинг, цільову аудиторію, рекламу й доступ до застосунку.
4. Для особистих акаунтів, створених після 13.11.2023, Google вимагає щонайменше 12 тестерів, які безперервно беруть участь у закритому тесті протягом 14 днів. Після цього подайте запит на доступ до Production. [Вимоги Google Play](https://support.google.com/googleplay/android-developer/answer/14151465)
