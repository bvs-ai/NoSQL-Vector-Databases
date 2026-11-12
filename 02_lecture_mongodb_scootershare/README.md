# Лекція 2. Практика ScooterShare

**Контекст.** Ви — бекенд-команда стартапу з оренди електросамокатів у Празі. Проєктуємо й
перевіряємо базу для мікросервісу: пошук вільних самокатів поблизу, аналітика поїздок, надійна
оренда.

Середовище: один вузол MongoDB 7.0 у Docker, запущений як **replica set `rs0`** — без цього не
працюють транзакції (частина 4).

Усі команди виконуються через `./demo.sh`. Кожна його команда — це одна звичайна команда `docker`:
скрипт спершу друкує її (рядок з `$`), а потім виконує. На Windows запускайте з WSL або Git Bash.

Готовий код до кожного завдання лежить у `scripts/` — його можна запустити (`./demo.sh run <файл>`)
або скопіювати в `mongosh` (`./demo.sh shell`) і виконувати по шматках.

| Скрипт | Завдання |
| --- | --- |
| `1_scooters.js` | датасет самокатів + геоіндекс (1.1) |
| `1_near.js` | 3 найближчі вільні самокати (1.2) |
| `2_trips.js` | генератор 5000 поїздок |
| `2_explain.js` | `explain()` без індексу та з compound-індексом (2.1–2.3) |
| `3_aggregation.js` | моделі самокатів + pipeline «топ за виручкою» (3) |
| `4_rent.js`, `4_reset.js`, `4_rollback.js` | транзакції: оренда, скидання, відкат (4.1–4.2) |
| `5_airbnb.js`, `5_shipwrecks.js` | бонуси на реальних даних (1.3, 3.2) |

---

## 0. Запуск

```bash
./demo.sh up
./demo.sh status
```
```
$ docker exec mongo-scooter mongosh --quiet --eval 'rs.status().members.forEach(m => print(m.name, m.stateStr))'
mongo:27017 PRIMARY
```

Контейнер `mongo-scooter-init` один раз виконує `rs.initiate(...)` і завершується
(див. `docker-compose.yml`). Порт 27017 відкрито на хост — можна підключити Compass.
Якщо порт зайнятий: `HOST_PORT=27027 ./demo.sh up`.

### Графічний клієнт: MongoDB Compass

Ті самі дані можна дивитися не лише через `mongosh`, а й у **MongoDB Compass**
(офіційний GUI, [завантажити](https://www.mongodb.com/try/download/compass)).
Рядок підключення:

```
mongodb://localhost:27017/?directConnection=true
```

`directConnection=true` обов'язковий. Вузол працює як replica set і повідомляє
клієнту своє внутрішнє ім'я `mongo:27017`, яке існує лише в Docker-мережі. Без цього
параметра Compass піде шукати хост `mongo` і завершиться помилкою
`Could not reach any servers in [('mongo', 27017)]`.
`./demo.sh compass` друкує рядок і запускає Compass, якщо він установлений.

Дані скриптів лежать у базі `test`: колекції `scooters`, `trips`, `scooter_models`.

---

## Частина 1. Дані та геопошук

```bash
./demo.sh run 1_scooters.js
```
```
Самокатів у колекції: 12
[ { _id: 1 }, { location: '2dsphere' } ]
```

Індекс `2dsphere` обов'язковий: без нього `$near` поверне помилку.

```bash
./demo.sh run 1_near.js
```

Користувач стоїть біля Můstek `[14.4230, 50.0840]`. Порядок у GeoJSON — **`[довгота, широта]`**.

```
sc-006  Ninebot Max   78%  [14.426, 50.0855]
sc-004  Ninebot Max   61%  [14.4231, 50.0875]
sc-001  Xiaomi Pro 2  87%  [14.4208, 50.088]
```

Скрипт також показує 5 найближчих **без** фільтра за статусом, з відстанню (`$geoNear`):

```
sc-006  free   78%  272 м
sc-004  free   61%  390 м
sc-002  busy   43%  425 м    ← був би третім, але зайнятий
sc-001  free   87%  472 м
sc-008  busy   90%  500 м
```

`$near` повертає документи, відсортовані за відстанню, тому `limit(3)` дає саме найближчі.

### Бонус 1.3: `sample_airbnb`

Потрібен Atlas Sample Dataset. Локально його можна завантажити з архіву
(~400 МБ, `https://atlas-education.s3.amazonaws.com/sampledata.archive`):

```bash
./demo.sh load-sample ~/Downloads/sampledata.archive
./demo.sh run 5_airbnb.js
```
```
Ринки в датасеті: Barcelona, Hong Kong, Istanbul, Kauai, Maui, Montreal, New York, Oahu, ..., Porto, Rio De Janeiro, Sydney, The Big Island

A. Біля Rossio, Лісабон (1 км):
  знайдено: 0

A'. Біля Praça da Liberdade, Порту (1 км):
  50.00  100  Porto Almada Story Apt Red by Porto City Hosts
  55.00  93  Center Secret  Studio
  ...

B. У колі 500 м від центру Порту: 66
```

> **Лісабона в датасеті немає** — з Португалії є лише Порту. Тому запит біля Rossio чесно
> повертає 0. Той самий запит для Порту знаходить оголошення.

`$centerSphere` приймає радіус у **радіанах**: `0.5 / 6378.1` = 500 м / радіус Землі.

**Для обговорення:** `$near` сортує за відстанню — для цього потрібен геоіндекс. `$geoWithin`
лише перевіряє «всередині фігури чи ні», без сортування — працює і без індексу (повним
скануванням), з індексом — швидше.

---

## Частина 2. Індекси та продуктивність

```bash
./demo.sh run 2_trips.js
./demo.sh run 2_explain.js
```
```
Вставлено записів: 5000

2.1  Без індексу
  план:               SORT <- COLLSCAN
  totalDocsExamined:  5000
  totalKeysExamined:  0
  nReturned:          94
  executionTimeMillis:2

2.2  З індексом { user_id: 1, date: -1 }
  план:               FETCH <- IXSCAN (user_id_1_date_-1)
  totalDocsExamined:  94
  totalKeysExamined:  94
  nReturned:          94
  executionTimeMillis:0
```

Дані випадкові: у вас буде інше число поїздок (~100) та інший час.

| Метрика | Без індексу | З індексом |
| --- | --- | --- |
| План | `SORT` ← `COLLSCAN` | `FETCH` ← `IXSCAN` |
| Переглянуто документів | 5000 | 94 |
| Сортування | в пам'яті (стадія `SORT`) | немає — ключі в індексі вже впорядковані за `date` |
| Час, мс | 2 | 0 |

На 5000 документів різниця в часі мізерна. Дивіться на **`totalDocsExamined`**: без індексу
вона росте разом з колекцією (50 млн поїздок — 50 млн прочитаних документів), з індексом —
лише разом з кількістю поїздок користувача.

Повний вивід `explain()` — у `mongosh`:

```js
db.trips.find({ user_id: "user_001" }).sort({ date: -1 }).explain("executionStats")
```

**Для обговорення:** два окремі індекси `{ user_id: 1 }` і `{ date: -1 }` не дадуть того самого:
MongoDB візьме один із них — і або відфільтрує, але сортуватиме в пам'яті, або пройде за датою
всю колекцію. Compound-індекс робить і фільтр, і сортування за один прохід.

---

## Частина 3. Агрегації

```bash
./demo.sh run 3_aggregation.js
```
```
{"total_trips":348,"scooter_id":"sc-002","model":"Segway Ninebot","top_speed":30,"range_km":40,"total_revenue":1584.9,"avg_duration":23.7}
{"total_trips":327,"scooter_id":"sc-004","model":"Ninebot Max","top_speed":30,"range_km":65,"total_revenue":1556.7,"avg_duration":25.1}
{"total_trips":329,"scooter_id":"sc-008","model":"Ninebot Max","top_speed":30,"range_km":65,"total_revenue":1532.45,"avg_duration":24.4}
...
```

Pipeline: `$match` → `$group` → `$sort` → `$lookup` (scooters) → `$unwind` → `$lookup`
(scooter_models) → `$project`.

**Для обговорення:** `$lookup` завжди повертає **масив** (навіть з одного документа). Без
`$unwind` шлях `scooter_info.model` вказує на масив `["Xiaomi Pro 2"]` — другий `$lookup` у цьому
випадку все одно спрацює (він порівнює кожен елемент масиву), але поле `scooter_info` у результаті
залишиться масивом. `$unwind` перетворює його на об'єкт; самокат без збігу `$unwind` викине з
результату.

### Бонус 3.2: `sample_geospatial.shipwrecks`

Потрібен той самий архів Atlas Sample Dataset, що й у бонусі 1.3. Якщо ви його ще не
завантажили, спершу виконайте `./demo.sh load-sample ~/Downloads/sampledata.archive`.

```bash
./demo.sh run 5_shipwrecks.js
```
```
Документів: 11095

A. Аварії за типами (feature_type):
    6578  Wrecks - Submerged, dangerous
    2585  Wrecks - Visible
    1845  Wrecks - Submerged, nondangerous
      64
      23  distributed remains of wreck

B. Глибина за типом води (watlev), depth > 0:
  {"max_depth":1828.8,"count":2566,"water_level":"always under water/submerged","avg_depth":14}

C. Балтика: lon 9..30, lat 53..66
  $geoWithin + $box:         0
  $match за latdec/londec:   0
  Межі датасету: lon -179.1490421..179.2982528, lat -64.7808992..70.3858306
  Великі озера [[-93,41],[-76,49]]: 756
  План з індексом 2d: FETCH <- IXSCAN
```

Що видно на реальних даних:

- значення `watlev` записані **малими літерами** (`always dry`, `covers and uncovers`, …);
  глибина `> 0` є лише в типу `always under water/submerged`, тому в завданні B одна група;
- 64 записи без `feature_type` (порожній рядок) — реальні дані «брудні»;
- **у Балтиці аварій немає**: це карти NOAA, переважно води США. Той самий `$box` для Великих
  озер знаходить 756 записів.

Поле `coordinates` — звичайна пара `[lon, lat]`, не GeoJSON. Для `$box` підходить індекс **`2d`**
(площинний): `db.shipwrecks.createIndex({ coordinates: "2d" })`.

---

## Частина 4. Транзакції

Оренда = дві операції: самокат `free → busy` + новий запис у `trips`. Вони мають виконатися
**обидві або жодна**.

### 4.1 Атомарна оренда

```bash
./demo.sh run 4_rent.js
```
```
✅ Успішно
{ _id: 'sc-003', status: 'busy' }
{ _id: ObjectId('...'), user_id: 'user_042', scooter_id: 'sc-003', status: 'active', date: ISODate('...'), price: 0 }
```

Повторний запуск — `❌ Помилка: Самокат зайнятий`: умова `status: "free"` у фільтрі `updateOne`
захищає від подвійної оренди.

### 4.2 Відкат

```bash
./demo.sh run 4_reset.js       # sc-003 знову free, активних поїздок 0
./demo.sh run 4_rollback.js
```
```
Крок 1 виконано: статус змінено на busy
  у транзакції:  busy
  поза транзакцією: free
❌ Транзакцію скасовано: 💥 Симуляція збою мережі / помилки бізнес-логіки
{ _id: 'sc-003', status: 'free' }
null
```

Крок 1 виконався, але його зміну бачить лише сама транзакція. Помилка всередині
`withTransaction()` — і драйвер викликає `abortTransaction()`: зміна зникає, поїздку не створено.

---

## Завершення

```bash
./demo.sh down
```
