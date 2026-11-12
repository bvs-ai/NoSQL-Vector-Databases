# NoSQL & Vector Databases — демо до лекцій

Практичні приклади до курсу. Одна папка — одна лекція, у кожній свій `README.md`:
що запустити і що побачити.

| Лекція | Тема | Папка |
| --- | --- | --- |
| 1 | Вступ до NoSQL, CAP і PACELC на кластері MongoDB | [`01_lecture_intro_nosql_cap`](01_lecture_intro_nosql_cap/) |
| 2 | Основи MongoDB: CRUD, геопошук, індекси, агрегації, транзакції (практика ScooterShare) | [`02_lecture_mongodb_scootershare`](02_lecture_mongodb_scootershare/) |

## Що потрібно

- Docker і Docker Compose (на Windows/macOS — Docker Desktop).
- На Windows скрипти `./lab.sh` / `./demo.sh` запускайте з Git Bash або WSL.

Кожне демо піднімається однією командою (`./lab.sh up` або `./demo.sh up` — див. README лекції)
і прибирається відповідною командою `down`.
