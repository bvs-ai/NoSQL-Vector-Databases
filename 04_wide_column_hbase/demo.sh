#!/usr/bin/env bash
# Допоміжний скрипт до практики теми 4 (HBase). Кожна команда — звичайна команда docker:
# скрипт спершу друкує її (рядок з $), а потім виконує. Можна набирати те саме вручну.
#
#   hbase         — HBase 2.1.3 standalone: Master + RegionServer + ZooKeeper + Thrift (9090)
#   hbase-client  — Python 3.12 + happybase, скрипти з ./scripts у /scripts
# Web UI: http://localhost:16010

cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1   # для Git Bash на Windows: не перетворювати шляхи /scripts/...

run() {
  local line="" a
  for a in "$@"; do
    case "$a" in
      *[!A-Za-z0-9_./:=-]*) line+=" '$a'" ;;
      *)                    line+=" $a" ;;
    esac
  done
  echo "\$$line"
  "$@"
}

# hbase shell без інтерактиву: команди з файлу або з рядка (-n — зупинка на першій помилці)
hshell() { docker exec -i hbase hbase shell -n 2>/dev/null; }

case "$1" in
  up)
    run docker compose up -d --build
    echo "Чекаємо, поки HBase Master завершить ініціалізацію і підніметься Thrift (до 60 с)..."
    for _ in $(seq 1 60); do
      docker exec hbase-client python -c "import happybase; happybase.Connection('hbase').tables()" \
        >/dev/null 2>&1 && break; sleep 2; done
    "$0" status ;;
  status)
    run docker compose ps --format 'table {{.Name}}\t{{.Status}}'
    echo "status 'simple'" | hshell ;;
  shell)      run docker exec -it hbase hbase shell ;;
  shell-file) echo "\$ docker exec -i hbase hbase shell -n < scripts/$2"
              hshell < "scripts/$2" ;;
  run)        run docker exec hbase-client python "/scripts/$2" ;;
  py)         run docker exec -it hbase-client python ;;
  step)       # крок за номером: ./demo.sh step 3.4 → scripts/3_4_*.py
    f=$(cd scripts && ls "${2/./_}"_[a-z]* 2>/dev/null)
    case "$f" in
      *.py)    "$0" run "$f" ;;
      *.hbase) "$0" shell-file "$f" ;;
      *)       echo "Немає кроку '$2'. Є: $(cd scripts && ls [0-9]_* | sed -E 's/^([0-9]+)_([0-9]+)_.*/\1.\2/' | xargs)"
               exit 1 ;;
    esac ;;
  hotspot)    # бонус до частини 3: pre-split таблиці + розподіл рядків по регіонах
    echo "\$ docker exec -i hbase hbase shell -n < scripts/3_6_hotspot.hbase"
    hshell < scripts/3_6_hotspot.hbase | grep '^Created table'
    run docker exec hbase-client python /scripts/3_7_hotspot_regions.py ;;
  regions)    # кількість запитів (REQ) по регіонах hot_* таблиць
    for t in hot_ts hot_server hot_salted; do
      echo "list_regions '$t', '', ['START_KEY', 'END_KEY', 'REQ']" ; done | hshell | grep -v '^$' ;;
  logs)       run docker exec hbase tail -n "${2:-30}" /hbase/logs/hbase--master-hbase.log ;;
  down)       run docker compose down -v ;;
  *)
    cat <<'HELP'
Використання: ./demo.sh <команда>
  up                    підняти HBase і клієнт, дочекатися готовності
  status                контейнери + status 'simple'
  shell                 інтерактивний HBase Shell (частина 1)
  shell-file <f.hbase>  виконати файл команд shell (./demo.sh shell-file 1_1_orders.hbase)
  run <script.py>       запустити Python-скрипт у клієнті (частини 2–4)
  step <N.M>            запустити крок за номером: step 3.4 = run 3_4_read_logs.py
  py                    інтерактивний Python з happybase
  hotspot               бонус ч.3: pre-split на 4 регіони, де опиняються рядки
  regions               бонус ч.3: запити (REQ) по регіонах hot_* таблиць
  logs [N]              останні рядки логу HBase Master
  down                  зупинити все і видалити дані
HELP
    ;;
esac
