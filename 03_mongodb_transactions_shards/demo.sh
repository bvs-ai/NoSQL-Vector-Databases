#!/usr/bin/env bash
# Практика теми 3: реплікація, транзакції, шардування.
#
# Номер команди = номер кроку заняття:  ./demo.sh 1.2  →  частина 1, крок 2.
# Кожна команда друкує справжню команду docker (рядок з "$") і виконує її —
# те саме можна набрати руками.
#
#   частини 1–2: replica set (rs-mongo1..3 + rs-client)        → docker-compose.yml
#   частина 3:   шардований кластер (cfg1..3, node11..23, mongos) → docker-compose.shard.yml
#
# Без аргументів — список усіх команд.

cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1   # Git Bash на Windows: не перетворювати шляхи /scripts/...

# Адреса ВСЬОГО replica set: драйвер сам знаходить Primary і перемикається після failover.
RS="mongodb://mongo1,mongo2,mongo3/?replicaSet=rs0"

# ───────────────────────── допоміжні функції ─────────────────────────

# Надрукувати команду так, як її можна набрати руками, і виконати.
run() {
  local line="" a
  for a in "$@"; do
    case "$a" in
      *[!A-Za-z0-9_./:=-]*) line+=" '$a'" ;;   # є пробіли чи спецсимволи — беремо в лапки
      *)                    line+=" $a" ;;
    esac
  done
  echo "\$$line"
  "$@"
}

# Тихо повторювати команду раз на секунду, поки вона не завершиться успішно (до 60 с).
wait_for() {
  for _ in $(seq 1 60); do "$@" >/dev/null 2>&1 && return 0; sleep 1; done
  echo "Не дочекалися: $*"; return 1
}

# Перевірити, що потрібний кластер запущено; інакше підказати команду.
need() {   # need <контейнер> <команда запуску>
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = true ] && return 0
  echo "Кластер не запущено. Спершу: $2"; exit 1
}

# Виконати скрипт зі scripts/ ...
rs_js()    { need rs-client "./demo.sh up";       run docker exec "${TTY[@]}" rs-client mongosh "${2:-$RS}" --quiet --file "/scripts/$1"; }  # ...через клієнта replica set
shard_js() { need mongos    "./demo.sh up shard"; run docker exec mongos mongosh --quiet --file "/scripts/$1"; }                           # ...на mongos

# Запитати в replica set ім'я вузла: mongo1 / mongo2 / mongo3.
rs_eval()   { docker exec rs-client mongosh "$RS" --quiet --eval "$1"; }
primary()   { rs_eval 'db.hello().primary.split(":")[0]'; }
secondary() { rs_eval 'rs.status().members.find(m => m.stateStr == "SECONDARY").name.split(":")[0]'; }

# ───────────────────────── запуск і зупинка ─────────────────────────

up_rs() {
  run docker compose -p rs up -d
  wait_for docker exec rs-mongo1 mongosh --quiet --eval 'db.adminCommand("ping")'
  run docker exec rs-mongo1 mongosh --quiet --eval 'rs.initiate({ _id: "rs0", members: [
    { _id: 0, host: "mongo1:27017" }, { _id: 1, host: "mongo2:27017" }, { _id: 2, host: "mongo3:27017" } ] })'
  echo "Чекаємо на вибори Primary..."
  wait_for rs_eval 'db.hello().primary || quit(1)'
  rs_js 1_1_status.js
}

up_shard() {
  run docker compose -p shard -f docker-compose.shard.yml up -d
  wait_for docker exec cfg1   mongosh --port 27019 --quiet --eval 'db.adminCommand("ping")'
  wait_for docker exec node11 mongosh --port 27018 --quiet --eval 'db.adminCommand("ping")'
  wait_for docker exec node21 mongosh --port 27018 --quiet --eval 'db.adminCommand("ping")'
  # Три replica set: config servers і два шарди
  run docker exec cfg1 mongosh --port 27019 --quiet --eval 'rs.initiate({ _id: "cfg", members: [
    { _id: 0, host: "cfg1:27019" }, { _id: 1, host: "cfg2:27019" }, { _id: 2, host: "cfg3:27019" } ] })'
  run docker exec node11 mongosh --port 27018 --quiet --eval 'rs.initiate({ _id: "shard1", members: [
    { _id: 0, host: "node11:27018" }, { _id: 1, host: "node12:27018" }, { _id: 2, host: "node13:27018" } ] })'
  run docker exec node21 mongosh --port 27018 --quiet --eval 'rs.initiate({ _id: "shard2", members: [
    { _id: 0, host: "node21:27018" }, { _id: 1, host: "node22:27018" }, { _id: 2, host: "node23:27018" } ] })'
  echo "Чекаємо: вибори Primary у шардах, mongos підключається до config servers..."
  wait_for docker exec node11 mongosh --port 27018 --quiet --eval 'db.hello().isWritablePrimary || quit(1)'
  wait_for docker exec node21 mongosh --port 27018 --quiet --eval 'db.hello().isWritablePrimary || quit(1)'
  wait_for docker exec mongos mongosh --quiet --eval 'db.adminCommand({ listShards: 1 }).ok || quit(1)'
  # Реєструємо шарди в кластері
  run docker exec mongos mongosh --quiet --eval '
    sh.addShard("shard1/node11:27018,node12:27018,node13:27018");
    sh.addShard("shard2/node21:27018,node22:27018,node23:27018");
    db.adminCommand({ listShards: 1 }).shards.forEach(s => print("Шард", s._id, "→", s.host))'
}

down_rs()    { run docker compose -p rs down -v; }
down_shard() { run docker compose -p shard -f docker-compose.shard.yml down -v; }

# ───────────────────────── частина 1: дії з вузлами ─────────────────────────

# Термінал 2: "вбити" поточний Primary. kill — раптове падіння, stop — коректна зупинка.
kill_primary() {
  need rs-client "./demo.sh up"
  local p; p=$(primary)
  echo "Зараз Primary: $p"
  run docker "${1:-kill}" "rs-$p"
}

# Повернути зупинені вузли й дочекатися, поки всі три знову будуть у replica set.
revive() {
  need rs-client "./demo.sh up"
  run docker start rs-mongo1 rs-mongo2 rs-mongo3
  echo "Чекаємо, поки вузол наздожене Primary і стане SECONDARY..."
  wait_for rs_eval 'rs.status().members.every(m => m.health == 1 && m.state <= 2) || quit(1)'
  rs_js 1_1_status.js
}

# Бонус: справжній rollback. Ізолюємо Primary від мережі й пишемо в нього з w:1.
rollback() {
  need rs-client "./demo.sh up"
  local p; p=$(primary)
  echo "── 1. Primary зараз $p. Відрізаємо його від мережі (він про це ще не знає)"
  run docker network disconnect rs-net "rs-$p"

  echo "── 2. Пишемо в ізольований вузол 5 замовлень з w:1 — він їх підтверджує"
  run docker exec "rs-$p" mongosh --quiet --eval '
    for (let k = 1; k <= 5; k++)
      db.getSiblingDB("test").orders.insertOne({ orderId: "ROLLBACK-" + k }, { writeConcern: { w: 1 } });
    print("Прийнято замовлень ROLLBACK-*:", db.getSiblingDB("test").orders.countDocuments({ orderId: /^ROLLBACK-/ }))'

  echo "── 3. Чекаємо 15 с: два інші вузли обирають нового Primary"
  sleep 15
  run docker exec rs-client mongosh "$RS" --quiet --eval '
    print("Новий Primary:", db.hello().primary);
    print("Замовлень ROLLBACK-* на ньому:", db.getSiblingDB("test").orders.countDocuments({ orderId: /^ROLLBACK-/ }));
    db.getSiblingDB("test").orders.insertOne({ orderId: "AFTER-FAILOVER" });
    print("Новий Primary прийняв замовлення AFTER-FAILOVER — історії двох вузлів розійшлися")'

  echo "── 4. Повертаємо мережу. Чекаємо 15 с: старий Primary відкочує свої 5 записів"
  run docker network connect rs-net "rs-$p"
  sleep 15

  echo "── 5. Відкочені записи не зникли безслідно — вони у файлах на диску старого Primary"
  run docker exec "rs-$p" bash -c 'for f in $(find /data/db/rollback -name "*.bson"); do echo "$f"; bsondump --quiet "$f"; done'
  run docker exec rs-client mongosh "$RS" --quiet --eval '
    print("Замовлень ROLLBACK-* у кластері:", db.getSiblingDB("test").orders.countDocuments({ orderId: /^ROLLBACK-/ }))'
}

# ───────────────────────── команди ─────────────────────────

case "$1" in
  up)    if [ "$2" = shard ]; then up_shard; else up_rs; fi ;;
  down)  case "$2" in rs) down_rs ;; shard) down_shard ;; *) down_rs; down_shard ;; esac ;;
  shell) # ./demo.sh shell — до всього replica set;  shell mongo2 — напряму до вузла;  shell mongos — до кластера
    case "$2" in
      "")     run docker exec -it rs-client mongosh "$RS" ;;
      mongos) run docker exec -it mongos mongosh ;;
      *)      run docker exec -it "rs-$2" mongosh ;;
    esac ;;

  # Частина 1 — replica set і відмовостійкість
  1.1)  rs_js 1_1_status.js ;;
  1.2)  rs_js 1_2_write_concern.js ;;
  1.3)  [ -t 0 ] && TTY=(-it)   # у терміналі — інтерактивно, щоб Ctrl+C зупиняв цикл
        if [ "$2" = raw ]; then rs_js 1_3_insert_loop.js "$RS&retryWrites=false&serverSelectionTimeoutMS=2000"
        else rs_js 1_3_insert_loop.js; fi ;;
  kill)     kill_primary "$2" ;;
  revive)   revive ;;
  1.4)  need rs-client "./demo.sh up"
        s=$(secondary); echo "Secondary зараз: $s — підключаємося напряму до нього"
        run docker exec "rs-$s" mongosh --quiet --file /scripts/1_4_read_secondary.js ;;
  rollback) rollback ;;

  # Частина 2 — транзакції (той самий replica set)
  2.1)  rs_js 2_1_setup.js ;;
  2.2)  rs_js 2_2_no_txn.js ;;
  2.3)  rs_js 2_3_txn.js ;;
  2.4)  rs_js 2_4_write_conflict.js ;;

  # Частина 3 — шардований кластер
  3.1)  shard_js 3_1_bad_key.js ;;
  3.2)  shard_js 3_2_good_key.js ;;
  3.3)  shard_js 3_3_compound_key.js ;;
  3.4)  shard_js 3_4_diagnostics.js ;;

  *) cat <<'HELP'
Запуск і зупинка
  ./demo.sh up            replica set для частин 1–2 (3 вузли + клієнт), ~15 с
  ./demo.sh up shard      шардований кластер для частини 3 (10 контейнерів), ~20 с
  ./demo.sh down          зупинити все й видалити дані   (down rs | down shard — щось одне)
  ./demo.sh shell [mongo2|mongos]   mongosh: до replica set / напряму до вузла / до mongos

Частина 1 — replica set і відмовостійкість
  ./demo.sh 1.1           ролі вузлів: хто PRIMARY, скільки замовлень записано
  ./demo.sh 1.2           write concern: w:1 проти w:"majority"
  ./demo.sh 1.3           ТЕРМІНАЛ 1: безперервна вставка замовлень (Ctrl+C — зупинити)
  ./demo.sh kill          ТЕРМІНАЛ 2: "вбити" Primary             (kill stop — коректна зупинка)
  ./demo.sh revive        повернути вбитий вузол і дочекатися, поки він стане SECONDARY
  ./demo.sh 1.4           читання з Secondary і read preference
  Бонуси:
  ./demo.sh 1.3 raw       та сама вставка без retryable writes — видно помилки під час виборів
  ./demo.sh rollback      справжній rollback: записи з w:1 зникають із бази (~40 с)

Частина 2 — транзакції
  ./demo.sh 2.1           дані складу: WIDGET-500 — 10 шт., GADGET-100 — 3 шт.
  ./demo.sh 2.2           дві операції БЕЗ транзакції, збій між ними → неузгоджений стан
  ./demo.sh 2.3           те саме В транзакції: зі збоєм (відкат) і без збою (успіх)
  ./demo.sh 2.4           WriteConflict: двоє купують останній товар

Частина 3 — шардування
  ./demo.sh 3.1           поганий shard key  { createdAt: 1 }           → усе на одному шарді
  ./demo.sh 3.2           хороший shard key  { _id: "hashed" }          → порівну
  ./demo.sh 3.3           складений ключ     { userId: 1, _id: "hashed" } → targeted-запити
  ./demo.sh 3.4           діагностика кластера: шарди, balancer, chunks
HELP
  ;;
esac
