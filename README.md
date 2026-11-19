# NoSQL & Vector Databases — демо до лекцій

Практичні приклади до курсу. Одна папка — одна лекція, у кожній свій `README.md`:
що запустити і що побачити.

| Лекція | Тема | Папка |
| --- | --- | --- |
| 1 | Вступ до NoSQL, CAP і PACELC на кластері MongoDB | [`01_lecture_intro_nosql_cap`](01_lecture_intro_nosql_cap/) |
| 2 | Основи MongoDB: CRUD, геопошук, індекси, агрегації, транзакції (практика ScooterShare) | [`02_lecture_mongodb_scootershare`](02_lecture_mongodb_scootershare/) |
| 3 | MongoDB: реплікація і write concern, транзакції, шардування | [`03_mongodb_transactions_shards`](03_mongodb_transactions_shards/) |
| 4 | Wide-column на прикладі Apache HBase: Shell, happybase, Row Key і hotspotting, версії і TTL ([завдання для самостійної роботи](04_wide_column_hbase/TASKS.md)) | [`04_wide_column_hbase`](04_wide_column_hbase/) |

## Що потрібно

- Docker і Docker Compose (на Windows/macOS — Docker Desktop).
- На Windows скрипти `./lab.sh` / `./demo.sh` запускайте з Git Bash або WSL.

Кожне демо піднімається однією командою (`./lab.sh up` або `./demo.sh up` — див. README лекції)
і прибирається відповідною командою `down`.
