# Лекція 4. Практика: Apache HBase

Практичне заняття з Apache HBase 2.1.3 у Docker, чотири частини:

1. **HBase Shell**: таблиця замовлень, `put` / `get` / `scan`, видалення і tombstones.
2. **Python і happybase**: завантаження CSV, читання, `batch` проти звичайного запису.
3. **Пастка Row Key**: hotspotting, salting + reversed timestamp.
4. **Версії і TTL**: `max_versions`, `time_to_live`.

Мережа й ключі не потрібні (крім першого завантаження образу). Python на хості не потрібен: скрипти
запускаються в клієнтському контейнері `hbase-client`. Скрипти перестворюють свої таблиці, тож їх можна
запускати повторно. Цифри нижче з реального прогону. У вас часові мітки, швидкість і розподіл рядків будуть трохи іншими.

Усі команди виконуються через `./demo.sh`. Кожна його команда — це одна звичайна команда `docker`:
скрипт спершу друкує її (рядок з `$`), а потім виконує. Те саме можна набрати руками.

## Що всередині

```
04_wide_column_hbase/
├── docker-compose.yml     hbase (harisekhon/hbase, HBase 2.1.3 standalone) + hbase-client (Python 3.12 + happybase 1.2.0)
├── demo.sh                пульт керування
├── TASKS.md               завдання для самостійної роботи
├── client/Dockerfile      образ клієнта
└── scripts/               1_1_orders.hbase, 2_*.py, 3_*.py, 3_6_hotspot.hbase, 4_*.py, movies.csv
```

У standalone-режимі Master, RegionServer і ZooKeeper живуть в одному процесі. Thrift-сервер (порт 9090) —
це те, до чого підключається `happybase`.

## Запуск

```bash
./demo.sh up        # збирає клієнт, піднімає HBase, чекає на Thrift (до 60 с), показує статус
```
```
NAME           STATUS
hbase          Up 5 seconds
hbase-client   Up 5 seconds
active master:  hbase:16000 1794603675369
0 backup masters
1 live servers
    hbase:16020 1794603676297
        requestsPerSecond=0.0, numberOfOnlineRegions=1, usedHeapMB=42, maxHeapMB=989, ...
0 dead servers
Aggregate load: 0, regions: 1
```

Web UI HBase Master: <http://localhost:16010> (розділи «Tables» і «Region Servers»; RegionServer UI — <http://localhost:16030>).
`./demo.sh` без аргументів друкує довідку.

| Команда | Що робить | Частина |
| --- | --- | --- |
| `./demo.sh up` | підняти HBase і клієнт, дочекатися готовності | — |
| `./demo.sh status` | контейнери + `status 'simple'` | — |
| `./demo.sh shell` | інтерактивний HBase Shell | 1 |
| `./demo.sh shell-file 1_1_orders.hbase` | виконати файл команд Shell одним прогоном | 1 |
| `./demo.sh run <script.py>` | запустити Python-скрипт у клієнті | 2–4 |
| `./demo.sh step <N.M>` | запустити крок за номером: `step 3.4` = `run 3_4_read_logs.py`, `step 1.1` = `shell-file 1_1_orders.hbase` | 1–4 |
| `./demo.sh py` | інтерактивний Python з `happybase` | 2–4 |
| `./demo.sh hotspot` | **бонус**: pre-split на 4 регіони, розподіл рядків | 3 |
| `./demo.sh regions` | **бонус**: запити (REQ) по регіонах | 3 |
| `./demo.sh logs [N]` | останні рядки логу HBase Master | — |
| `./demo.sh down` | зупинити все і видалити дані | — |

| Скрипт | Крок | Статус |
| --- | --- | --- |
| `1_1_orders.hbase` | перші команди Shell | основне |
| `2_1_load_movies.py`, `2_2_read_movies.py` | CSV у HBase, читання, фільтр на клієнті і на сервері | основне |
| `2_3_batch_speed.py` | `batch` проти звичайного запису | основне |
| `3_1_setup_logs.py`, `3_2_logs_bad.py`, `3_3_logs_good.py`, `3_4_read_logs.py` | hotspotting і salting | основне |
| `3_6_hotspot.hbase` + `3_7_hotspot_regions.py` (`./demo.sh hotspot`, `regions`) | розподіл по регіонах | **бонус** |
| `4_1_versions_write.py`, `4_2_versions_read.py`, `4_3_ttl.py` | версії і TTL | основне |
| `4_4_raw.hbase` | що лежить на диску до compaction | **бонус** |

Номер кроку — перші дві цифри імені скрипта: `3_4_read_logs.py` → `./demo.sh step 3.4`.

Бонуси беріть останніми й за бажанням: вони поглиблюють частини 3 і 4, а основна лінія без них не постраждає.

## Що потрібно

- Docker + Docker Compose. Пам'ять: HBase займає ~1.3 ГБ.
- Windows: запускайте `./demo.sh` з Git Bash або WSL.
- Вільні порти на хості: 9090 (Thrift), 16010 (Master UI), 16030 (RegionServer UI).
- Образ `harisekhon/hbase` — це HBase 2.1.3 від 2019 року, лише `amd64`. На Apple Silicon він працює
  через емуляцію, тож повільно: `./demo.sh up` може чекати довше.

---

## Частина 1. HBase Shell

```bash
./demo.sh shell                        # інтерактивно: набирайте команди з викладачем
./demo.sh shell-file 1_1_orders.hbase    # або все одним прогоном (те саме, що нижче)
```

У файлі `1_1_orders.hbase` лежать усі команди частини 1. Нижче — вивід `shell-file` з реального прогону
(скорочено, порожні «Took ...» прибрано).

### Версія і статус кластера

```
2.1.3, rda5ec9e4c06c537213883cca8f3cc9a7c19daf67, Mon Feb 11 15:45:33 CST 2019
1 active master, 0 backup masters, 1 servers, 0 dead, 1.0000 average load
```

**На що звернути увагу:** `1 servers, 0 dead` — це наш єдиний RegionServer. У production тут були б десятки.

### Таблиця з трьома Column Family

```
create 'orders', 'info', 'items', 'status'
```
```
Created table orders
...
Table orders is ENABLED
orders
COLUMN FAMILIES DESCRIPTION
{NAME => 'info', VERSIONS => '1', ..., TTL => 'FOREVER', MIN_VERSIONS => '0', ..., BLOOMFILTER => 'ROW', ..., BLOCKSIZE => '65536'}
{NAME => 'items', VERSIONS => '1', ...}
{NAME => 'status', VERSIONS => '1', ...}
3 row(s)
```

**На що звернути увагу:** оголошуються лише Column Family, а колонки (qualifier) з'являються під час запису.
Зверніть увагу на `VERSIONS => '1'` і `TTL => 'FOREVER'`: це типові значення, у частині 4 ми їх змінимо.

### Читання

```
get 'orders', 'order_001'
```
```
COLUMN  CELL
 info:created_at timestamp=1794603690890, value=2026-04-01
 info:customer_id timestamp=1794603690873, value=cust_100
 info:total timestamp=1794603690885, value=5990
 items:item_1 timestamp=1794603690896, value=\xD0\x9D\xD0\xBE\xD1\x83\xD1\x82\xD0\xB1\xD1\x83\xD0\xBA ASUS
 items:item_2 timestamp=1794603690902, value=\xD0\x9C\xD0\xB8\xD1\x88\xD0\xB0 Logitech
 status:current timestamp=1794603690908, value=new
1 row(s)
```

Решта команд читання: `get ... 'info:total'`, `get ... {COLUMNS => [...]}`, `scan 'orders'`, `scan ... {LIMIT => 2}`,
`scan ... {COLUMNS => 'info:total'}`.

```
scan 'orders', {COLUMNS => 'info:total'}
```
```
ROW  COLUMN+CELL
 order_001 column=info:total, timestamp=1794603690885, value=5990
 order_002 column=info:total, timestamp=1794603690922, value=1200
 order_003 column=info:total, timestamp=1794603690961, value=350
3 row(s)
```

**На що звернути увагу:**

- `order_001` має два товари, `order_002` і `order_003` — по одному. Колонки `items:item_2` у них просто немає
  (не `NULL`): це **розрідженість**.
- Кирилиця в HBase Shell друкується як `\xD0\x9D\xD0\xBE...`: shell показує байти, а HBase зберігає значення
  як байти без кодування. Рішення: `FORMATTER => 'toString'` у `scan` або `'cf:col:toString'` у `get`.
  Обидва варіанти є в `1_1_orders.hbase`:

```
scan 'orders', {COLUMNS => 'items', FORMATTER => 'toString'}
```
```
 order_001 column=items:item_1, timestamp=1794603690896, value=Ноутбук ASUS
 order_001 column=items:item_2, timestamp=1794603690902, value=Миша Logitech
 order_002 column=items:item_1, timestamp=1794603690938, value=Клавіатура
 order_003 column=items:item_1, timestamp=1794603690973, value=Килимок для миші
3 row(s)
```
```
get 'orders', 'order_001', 'items:item_1:toString'
```
```
 items:item_1 timestamp=1794603690896, value=Ноутбук ASUS
```

### Видалення

```
delete 'orders', 'order_003', 'status:current'
get 'orders', 'order_003'          # колонки status:current вже немає
deleteall 'orders', 'order_003'
scan 'orders'                      # лишилися order_001 і order_002 (2 row(s))
```

Тепер головне: що фізично відбулося? Дивимося RAW-сканом, який показує і службові маркери:

```
scan 'orders', {RAW => true, VERSIONS => 10, STARTROW => 'order_003'}
```
```
ROW  COLUMN+CELL
 order_003 column=info:, timestamp=1794603691129, type=DeleteFamily
 order_003 column=info:created_at, timestamp=1794603690968, value=2026-04-03
 order_003 column=info:customer_id, timestamp=1794603690952, value=cust_100
 order_003 column=info:total, timestamp=1794603690961, value=350
 order_003 column=items:, timestamp=1794603691129, type=DeleteFamily
 order_003 column=items:item_1, timestamp=1794603690973, value=\xD0\x9A\xD0\xB8\xD0\xBB...
 order_003 column=status:, timestamp=1794603691129, type=DeleteFamily
 order_003 column=status:current, timestamp=1794603690979, type=Delete
 order_003 column=status:current, timestamp=1794603690979, value=delivered
1 row(s)
```

**На що звернути увагу:** `delete` і `deleteall` **не стирають дані одразу**. Вони дописують маркери-надгробки
(tombstones): `type=Delete` для однієї колонки і `type=DeleteFamily` для сімейства. Звичайний `get` і `scan` ці
значення вже ховають, але вони все ще лежать у файлах. Фізично зникнуть лише при major compaction
(побачимо в бонусі `4_4_raw.hbase`, див. частину 4).

Після частини 1 таблицю `orders` видно у Web UI (<http://localhost:16010>, розділ «Tables»).

---

## Частина 2. Python і happybase

### 2_1_load_movies.py — CSV у HBase через batch

```bash
./demo.sh run 2_1_load_movies.py
```
```
Таблиця 'movies' створена
Завантажуємо дані з movies.csv...
  Додано: movie_001 — Inception
  Додано: movie_002 — The Godfather
  ...
  Додано: movie_010 — The Silence of the Lambs

Дані успішно завантажені!
```

Скрипт створює таблицю `movies` з двома Column Family (`info`, `meta`), а рядки пише через `table.batch()`.
Row Key — `movie_id`. Якщо таблиця вже була, скрипт спершу її видаляє.

### 2_2_read_movies.py — читання і «фільтрація»

```bash
./demo.sh run 2_2_read_movies.py
```
```
1. Читаємо один фільм за ID
Заголовок: Inception
...
2. Читаємо кілька фільмів одразу
movie_002: The Godfather (рейтинг: 9.2)
movie_005: The Dark Knight (рейтинг: 9.0)
movie_009: Fight Club (рейтинг: 8.8)

3. Скануємо всі фільми, виводимо тільки назву і рейтинг
movie_001: Inception — 8.8
...
4. Фільтрація на стороні клієнта: фільми з рейтингом >= 8.9
9.2 — The Godfather
9.0 — The Dark Knight
8.9 — Pulp Fiction
(прочитано з сервера рядків: 10, знайдено: 3)

5. Серверний фільтр: той самий запит, що в п. 4
filter = SingleColumnValueFilter('info', 'rating', >=, 'binary:8.9', true, true)
9.2 — The Godfather
8.9 — Pulp Fiction
9.0 — The Dark Knight
(отримано з сервера рядків: 3)

```

**На що звернути увагу:** пункт 4 прочитав **всі 10 рядків**, щоб знайти 3. Індексу за значенням у HBase
немає: єдиний «індекс» — це Row Key. На 10 рядках це непомітно, на 10 мільйонах — катастрофа.
Тому проєктування Row Key так важливе (частина 3).

Пункт 5 робить те саме серверним фільтром: `table.scan(filter="SingleColumnValueFilter(...)")`. Тепер
клієнт отримує лише 3 рядки. Але RegionServer однаково перебирає всю таблицю: фільтр економить мережу,
а не читання. Швидко — тільки за Row Key. Ще одна пастка: `binary:` порівнює байти, а не числа. Рейтинги
тут усі формату `X.Y`, тому порядок правильний; рядок `'10.0'` опинився б «меншим» за `'8.9'`.

Спробуйте той самий підхід самостійно: [завдання 1 у TASKS.md](TASKS.md#завдання-1-фільми-одного-режисера).

### 2_3_batch_speed.py — batch проти звичайного запису

```bash
./demo.sh run 2_3_batch_speed.py
```
```
Звичайний запис 500 рядків: 0.63 сек (1.25 мс/рядок)
Batch запис 500 рядків:     0.02 сек (0.05 мс/рядок)

Batch швидший у 26.2 разів
```

**На що звернути увагу:** кожен `put` — окремий мережевий запит, а `batch` групує їх у пачки. У двох прогонах вийшло
15.0 і 26.2 рази, тобто **у 15–30 разів**. Точне число залежить від вашої машини. У Docker на одній машині мережа
майже безкоштовна, між серверами різниця була б ще більшою.

---

## Частина 3. Пастка з Row Key: hotspotting

Ключова частина заняття: ви самі натикаєтеся на проблему й самі її виправляєте. Порядок: `3_1_setup_logs` → `3_2_logs_bad` →
`3_3_logs_good` → `3_4_read_logs`. Після них — [завдання 2 у TASKS.md](TASKS.md#завдання-2-row-key-для-замовлень-інтернет-магазину).

### 3_1_setup_logs.py — підготовка таблиць

```bash
./demo.sh run 3_1_setup_logs.py
```
```
Таблиці створені
```

Створює (з нуля) дві таблиці `logs_bad` і `logs_good` з Column Family `log`.

### 3_2_logs_bad.py — поганий ключ: timestamp на початку

```bash
./demo.sh run 3_2_logs_bad.py
```
```
Записуємо логи з ПОГАНИМ Row Key: timestamp_server_id
Формат ключа: 1744000001000_web-01

  1744000000000_web-01
  1744000001000_web-02
  1744000002000_web-03
  1744000003000_web-01
  ...
  1744000014000_web-03
```

**На що звернути увагу:** усі ключі починаються з `174400...` і ростуть строго зверху вниз. HBase зберігає рядки
відсортованими за ключем, а регіони — це діапазони ключів. Кожен новий запис більший за попередні, тож **усі нові
записи потрапляють в останній регіон**. Один RegionServer перевантажений, решта простоюють: кластер не масштабується по запису.

### 3_3_logs_good.py — salting + reversed timestamp

```bash
./demo.sh run 3_3_logs_good.py
```
```
Записуємо логи з ГАРНИМ Row Key: salt:server_id:reversed_timestamp

Розподіл серверів по кошиках:
  web-01 → кошик 2
  web-02 → кошик 1
  web-03 → кошик 1

  1:web-02:8255999986999
  1:web-02:8255999989999
  ...
  1:web-03:8255999985999
  ...
  2:web-01:8255999987999
  ...
  2:web-01:8255999999999
```

Ключ складається з трьох частин: `сіль : server_id : reversed_timestamp`. Сіль — це `md5(server_id) % 4`
(4 «кошики»), а reversed timestamp — це `9_999_999_999_999 - timestamp`.

**На що звернути увагу:**

- `web-02` і `web-03` отримали **однаковий** кошик 1, `web-01` — кошик 2, а кошики 0 і 3 порожні. Хеш від
  `server_id` для 3 серверів і 4 кошиків не гарантує різних кошиків.
- Усі записи **одного** сервера завжди йдуть в один кошик. Це «hashed prefix», а не рівномірний розподіл
  записів. Розподіл по регіонах стає добрим, коли серверів (або покупців, див. нижче) багато.
- Усередині сервера ключі йдуть від свіжих до старих: reversed timestamp з'являється як спадний час, тому
  `scan` першими віддає найновіші логи, без додаткового сортування.

### 3_4_read_logs.py — читання логів одного сервера

```bash
./demo.sh run 3_4_read_logs.py
```
```
Останні логи для web-01:
  2:web-01:8255999987999  [web-01] Response sent
  2:web-01:8255999990999  [web-01] User authenticated
  ...
Останні логи для web-02:
  1:web-02:8255999986999  [web-02] Cache miss
  ...
```

**На що звернути увагу:** щоб прочитати логи `web-01`, ми обчислюємо ту саму сіль, що і при записі, і робимо
`scan` по діапазону `2:web-01:` ... `2:web-01;` (символ `;` більший за `:` в ASCII). Це один range-scan.
Якби нам потрібні були логи **всіх** серверів за період, довелося б сканувати всі 4 кошики і зливати результат
на клієнті (scatter-gather). Це компроміс: запис розподілений, зате «широкі» читання дорожчі.

### Самостійне завдання

Row Key для замовлень інтернет-магазину: [завдання 2 у TASKS.md](TASKS.md#завдання-2-row-key-для-замовлень-інтернет-магазину).

**Головний висновок частини:** Row Key у HBase — це одночасно і індекс, і механізм розподілу навантаження.

### Бонус: `./demo.sh hotspot` і `./demo.sh regions` — де лежать рядки

> **Бонус.** Поглиблює частину 3: показує hotspotting цифрами. Можна пропустити: основна лінія лекції
> від цього не постраждає.

```bash
./demo.sh hotspot    # 3 таблиці, pre-split на 4 регіони, по 3000 рядків у кожну, розподіл рядків
./demo.sh regions    # скільки запитів (REQ) обробив кожен регіон
```
```
Created table hot_ts
Created table hot_server
Created table hot_salted

hot_ts   приклад ключа: 1744000000000_web-01
  регіон [ -∞ .. 1  )      0 рядків
  регіон [  1 .. 2  )   3000 рядків  ##############################
  регіон [  2 .. 3  )      0 рядків
  регіон [  3 .. +∞ )      0 рядків

hot_server   приклад ключа: 2:web-01:8255999999999
  регіон [ -∞ .. 1  )      0 рядків
  регіон [  1 .. 2  )   2000 рядків  ####################
  регіон [  2 .. 3  )   1000 рядків  ##########
  регіон [  3 .. +∞ )      0 рядків

hot_salted   приклад ключа: 0:web-01:8255999999999
  регіон [ -∞ .. 1  )    780 рядків  #######
  регіон [  1 .. 2  )    799 рядків  #######
  регіон [  2 .. 3  )    705 рядків  #######
  регіон [  3 .. +∞ )    716 рядків  #######

Читання останніх логів web-01:
  hot_server: 1 range-scan (префікс відомий)
  hot_salted: 4 range-scan'и (по одному на кошик) + злиття на клієнті
```

Таблиці створені з pre-split: 4 регіони з межами `1`, `2`, `3`. Це дає змогу побачити розподіл на одному RegionServer.

| Таблиця | Ключ | Розподіл рядків по регіонах |
| --- | --- | --- |
| `hot_ts` | `timestamp_server` | 3000 в одному регіоні `[1..2)` |
| `hot_server` | `salt(server):server:rev_ts` (сіль від server_id) | 2000 і 1000 у двох регіонах |
| `hot_salted` | сіль від timestamp | ~700–800 у кожному |

`./demo.sh regions` показує REQ (запити) по регіонах — по черзі `hot_ts`, `hot_server`, `hot_salted`:

```
  START_KEY |    END_KEY |   REQ |
 ---------- | ---------- | ----- |
            |          1 |     0 |
          1 |          2 |  6000 |
          2 |          3 |     0 |
          3 |            |     0 |
 4 rows
  START_KEY |    END_KEY |   REQ |
 ---------- | ---------- | ----- |
            |          1 |     0 |
          1 |          2 |  4000 |
          2 |          3 |  2000 |
          3 |            |     0 |
 4 rows
  START_KEY |    END_KEY |   REQ |
 ---------- | ---------- | ----- |
            |          1 |  1560 |
          1 |          2 |  1598 |
          2 |          3 |  1410 |
          3 |            |  1432 |
 4 rows
```

**На що звернути увагу:**

- REQ — це записи **плюс** читання. Скрипт сам перераховує рядки `scan`'ом, тому `6000` = 3000 `put` + 3000 читання.
- Сіль від `timestamp` розподіляє майже рівно, але читання логів одного сервера тепер вимагає 4 range-scan
  і злиття на клієнті (scatter-gather). Сіль від `server_id` розподіляє гірше, зате читання одного сервера — один scan.
  Це і є компроміс вибору Row Key.

---

## Частина 4. Версії і TTL

### 4_1_versions_write.py і 4_2_versions_read.py — історія змін

```bash
./demo.sh run 4_1_versions_write.py    # 6 записів однієї комірки з паузою 0.3 с
./demo.sh run 4_2_versions_read.py     # поточне значення і вся історія
```
```
Записуємо 6 версій однієї комірки з паузою 0.3 сек між ними

  Записана ціна: 1000 USD
  Записана ціна: 1100 USD
  Записана ціна: 950 USD
  Записана ціна: 1200 USD
  Записана ціна: 1050 USD
  Записана ціна: 1300 USD
```
```
Поточна ціна (остання версія):
  1300 USD

Історія змін ціни (всі доступні версії):
  21:01:41.753  → 1300 USD
  21:01:41.450  → 1050 USD
  21:01:41.147  → 1200 USD
  21:01:40.845  → 950 USD
  21:01:40.541  → 1100 USD

Версій повернуто: 5
```

**На що звернути увагу:** таблиця `versioned` створена з `max_versions=5`, а ми записали 6 значень. Повертається
**5**: найстаріша версія (1000) уже не читається. Скрипт читання просить `versions=10` (з запасом) і колонку
`data:price`, тож «5» обмежує саме таблиця, а не запит. Це не означає, що 1000 зникла з диска, див. бонус `4_4_raw.hbase`.
Час у виводі — за годинником контейнера (за замовчуванням UTC).

### 4_3_ttl.py — TTL на рівні Column Family

```bash
./demo.sh run 4_3_ttl.py
```
```
Створюємо сесію користувача...
Сесія записана

Читаємо одразу:
  session:ip: 192.168.1.100
  session:token: eyJhbGciOiJIUzI1NiJ9
  user:user_id: user_42
  user:username: ivan_petrov

Чекаємо 6 секунд (TTL = 5 сек)...

Читаємо після закінчення TTL:
  user:user_id: user_42
  user:username: ivan_petrov
```

**На що звернути увагу:**

- Після 6 секунд рядок **не порожній**: лишилися `user:*`. TTL задається на **Column Family**, а не на рядок.
  У `sessions` TTL має тільки `session`, а `user` — без TTL. Тому гілка «Рядок порожній» у скрипті не спрацьовує.
- Звичайне читання вже не віддає прострочені комірки `session:*`, хоча фізично вони лежать на диску до major compaction
  (перевіряємо в бонусі нижче).

### Бонус: 4_4_raw.hbase — що лежить на диску

> **Бонус.** Поглиблює частину 4: показує різницю між «не читається» і «видалено фізично». Можна пропустити:
> основна лінія лекції від цього не постраждає.

```bash
./demo.sh step 4.4   # RAW-скан versioned і sessions -> flush + major_compact -> пауза 5 с -> RAW-скан знову
```

Спершу (до compaction):

```
ROW  COLUMN+CELL
 product_001 column=data:price, timestamp=1794603701753, value=1300
 product_001 column=data:price, timestamp=1794603701450, value=1050
 product_001 column=data:price, timestamp=1794603701147, value=1200
 product_001 column=data:price, timestamp=1794603700845, value=950
 product_001 column=data:price, timestamp=1794603700541, value=1100
 product_001 column=data:price, timestamp=1794603700237, value=1000
1 row(s)

ROW  COLUMN+CELL
 sess_abc123 column=session:ip, timestamp=1794603703213, value=192.168.1.100
 sess_abc123 column=session:token, timestamp=1794603703213, value=eyJhbGciOiJIUzI1NiJ9
 sess_abc123 column=user:user_id, timestamp=1794603703213, value=user_42
 sess_abc123 column=user:username, timestamp=1794603703213, value=ivan_petrov
1 row(s)
```

Після `major_compact` (через 5 с):

```
 product_001 column=data:price, timestamp=1794603701753, value=1300
 ...
 product_001 column=data:price, timestamp=1794603700541, value=1100
1 row(s)

 sess_abc123 column=user:user_id, timestamp=1794603703213, value=user_42
 sess_abc123 column=user:username, timestamp=1794603703213, value=ivan_petrov
1 row(s)
```

**На що звернути увагу:** до compaction RAW-скан показує **усі 6 версій** ціни (включно з 1000) і прострочені
`session:*`. Після major compaction лишилося 5 версій, а `session:*` зникли фізично. Тобто дані «зникають»
двічі: спочатку для читання, пізніше з файлів. Така сама логіка і в tombstones із частини 1.

---

## Типові проблеми

| Проблема | Що робити |
| --- | --- |
| `ModuleNotFoundError: No module named 'pkg_resources'` | `happybase 1.2.0` на свіжому Python потребує старого `setuptools`: `pip install "setuptools<81" happybase`. У клієнтському контейнері це вже зроблено; попередження `UserWarning` приглушене через `PYTHONWARNINGS`. |
| Хочете запускати скрипти з хоста | `pip install "setuptools<81" happybase`, потім `cd scripts && python 2_1_load_movies.py`. `HBASE_HOST` за замовчуванням `localhost`, порт 9090 опублікований. |
| Повторний `shell-file 1_1_orders.hbase` дає помилку на `create` | Таблиця `orders` уже існує. Спершу `./demo.sh down && ./demo.sh up`. |
| `./demo.sh up` скаржиться на зайнятий порт | Звільніть 9090, 16010 і 16030 (або зупиніть інший HBase). |
| `./demo.sh up` довго чекає | HBase стартує до ~60 с. На Apple Silicon образ `amd64` працює через емуляцію, повільніше. Подивіться `./demo.sh logs`. |
| Не вистачає пам'яті | HBase займає ~1.3 ГБ. Закрийте зайве або збільште ліміт Docker. |

## Прибирання

```bash
./demo.sh down    # зупиняє контейнери і видаляє дані (docker compose down -v)
```

## Що забрати із заняття

1. HBase зберігає **рядки, відсортовані за Row Key**; колонки об'єднані в Column Family, а самі колонки не оголошуються заздалегідь.
2. Відсутня колонка не займає місця: розрідженість замість `NULL`.
3. Видалення в HBase — це **tombstone**, а не стирання; фізично дані зникають при major compaction.
4. Без фільтрів HBase не шукає за значенням: «індекс» — лише Row Key, тож інакше доводиться читати все.
5. `batch` скорочує кількість мережевих запитів і дає прискорення в рази (у нашому прогоні 15–26).
6. Монотонний ключ (timestamp на початку) створює hotspot: усі записи йдуть в один регіон. Лікують сіль і reversed timestamp, але ціна — scatter-gather при «широких» читаннях.
7. `max_versions` і `TTL` керують життєвим циклом даних; TTL діє на Column Family і не обов'язково на весь рядок.

Найчастіша помилка на практиці: почати з «природного» ключа (час або послідовний ID) і виявити hotspot уже на живому навантаженні, коли ключ змінити дорого.
