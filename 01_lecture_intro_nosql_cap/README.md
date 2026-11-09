# Лекція 1. CAP-теорема на живому кластері MongoDB

Три вузли MongoDB (replica set) у Docker. По черзі ламаємо кластер і дивимося,
що MongoDB обирає: **C** (узгодженість) чи **A** (доступність).

## Що потрібно

Docker і Docker Compose. На Windows `./lab.sh` запускайте з Git Bash або WSL.

## Запуск

```bash
./lab.sh up
```

```
mongo1   PRIMARY
mongo2   SECONDARY
mongo3   SECONDARY
```

У базі `shop` вже є документ `{_id: 1, status: "NEW"}`. Після кожного кроку виконуйте `./lab.sh heal`.

---

## Крок 1. Слабка узгодженість: репліка віддає старі дані

Затримуємо мережу primary на 1 секунду:

```bash
./lab.sh delay mongo1 1000
```

**Термінал 1:** читаємо документ із репліки mongo2 кожні 0.3 с:

```bash
./lab.sh watch mongo2
```

**Термінал 2:** змінюємо документ на primary:

```bash
./lab.sh shell
```
```js
db.items.updateOne({_id: 1}, {$set: {status: "PAID"}}, {writeConcern: {w: 1}})
```

У терміналі 1:

```
15:23:03.747 SECONDARY status = NEW      ← primary вже записав PAID
15:23:04.656 SECONDARY status = NEW
15:23:04.959 SECONDARY status = PAID     ← репліка наздогнала
```

Запис підтверджено одразу, але ще ~1 с репліка віддає **старе** значення.
Це **eventual consistency**: дані зрештою зійдуться.

**Ціна узгодженості (PACELC).** У тому ж терміналі 2 заміряємо час запису:

```js
let t = Date.now(); db.items.updateOne({_id: 1}, {$set: {status: "NEW"}}, {writeConcern: {w: 1}}); Date.now() - t
// 14            ← мс: відповів лише primary

t = Date.now(); db.items.updateOne({_id: 1}, {$set: {status: "PAID"}}, {writeConcern: {w: "majority"}}); Date.now() - t
// 1151          ← мс (буває до ~2000): чекали, поки репліка підтвердить
```

Збою немає, а вибір є: швидкість (L) або узгодженість (C).

```bash
./lab.sh heal
```

## Крок 2. Немає більшості — немає запису

Зупиняємо дві репліки з трьох:

```bash
./lab.sh stop mongo2 mongo3
```

Зачекайте ~10 с і перевірте:

```bash
./lab.sh status
```
```
mongo1   SECONDARY
mongo2   недоступний
mongo3   недоступний
```

mongo1 живий, але **сам** перестав бути primary: він не бачить більшості (2 з 3).
Спробуйте записати:

```bash
./lab.sh shell
```
```js
db.items.insertOne({_id: 2, status: "NEW"})
```
```
MongoServerError: not primary
```

Запис неможливий за будь-якого `writeConcern`. MongoDB жертвує **A** заради **C**.

```bash
./lab.sh start mongo2 mongo3
```

## Крок 3. Розрив мережі: підтверджений запис зникає

**Термінал 1:** відкрийте shell заздалегідь:

```bash
./lab.sh shell
```

**Термінал 2:** відрізаємо mongo1 від двох інших вузлів:

```bash
./lab.sh isolate mongo1
```

**Термінал 1:** одразу (поки не минуло ~10 с) пишемо в mongo1:

```js
db.items.insertOne({_id: "order-42", status: "PAID"}, {writeConcern: {w: 1}})
// { acknowledged: true, insertedId: 'order-42' }      ← OK!

db.items.insertOne({_id: "order-43"}, {writeConcern: {w: "majority", wtimeout: 3000}})
// MongoWriteConcernError: waiting for replication timed out
```

mongo1 ще вважає себе primary і приймає `w: 1`. А `w: "majority"` не підтверджено:
більшість недосяжна.

Тим часом mongo2 і mongo3 обрали нового primary:

```bash
./lab.sh status
```
```
mongo1   SECONDARY
mongo2   PRIMARY
mongo3   SECONDARY
```

Відновлюємо мережу, чекаємо ~20 с і шукаємо замовлення:

```bash
./lab.sh heal
./lab.sh shell
```
```js
db.items.findOne({_id: "order-42"})
// null
```

Клієнт отримав «OK», а замовлення **немає**. При поверненні mongo1 зробив **rollback**:
записи, яких не було в більшості, відкочено (копія лишилась у `/data/db/rollback/`).

## Висновок

| Налаштування | Що отримуємо | Чим платимо |
| --- | --- | --- |
| `w: 1`, читання з реплік | швидко (L) і доступно (A) | старі дані, втрата записів (C) |
| `w: "majority"` | запис не загубиться (C) | повільніше (L), при збої — помилка (A) |

Розрив мережі (P) неминучий. Обирати доводиться між C і A.

## Команди

```bash
./lab.sh            # довідка
./lab.sh down       # зупинити все й видалити дані
```
