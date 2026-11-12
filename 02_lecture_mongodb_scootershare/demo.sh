#!/usr/bin/env bash
# Допоміжний скрипт: кожна команда — це одна звичайна команда docker.
# Перед виконанням скрипт друкує її (рядок з $), щоб було видно, що саме запускається.

cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1   # для Git Bash на Windows: не перетворювати шляхи /scripts/...

C=mongo-scooter   # контейнер з MongoDB

# Друкує команду (як її можна набрати руками) і виконує її.
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

case "$1" in
  up)          run docker compose up -d ;;
  status)      run docker exec $C mongosh --quiet --eval 'rs.status().members.forEach(m => print(m.name, m.stateStr))' ;;
  shell)       run docker exec -it $C mongosh ;;
  run)         run docker exec $C mongosh --quiet --file "/scripts/$2" ;;
  load-sample) run docker cp "$2" $C:/tmp/sampledata.archive
               run docker exec $C mongorestore --quiet --archive=/tmp/sampledata.archive \
                 --nsInclude='sample_airbnb.*' --nsInclude='sample_geospatial.*' ;;
  compass)     uri="mongodb://localhost:${HOST_PORT:-27017}/?directConnection=true"
               echo "Compass: $uri"
               # Бонус: Compass не обов'язковий. Немає команди — просто підказка, без помилки.
               if command -v mongodb-compass >/dev/null 2>&1; then
                 run mongodb-compass "$uri" &
               else
                 echo "Compass не знайдено як команду — відкрийте його вручну і вставте цей рядок."
               fi ;;
  down)        run docker compose down -v ;;
  *)
    echo "./demo.sh up                 запустити MongoDB (replica set rs0 з одного вузла)"
    echo "./demo.sh status             роль вузла (має бути PRIMARY)"
    echo "./demo.sh shell              відкрити mongosh — писати запити вручну"
    echo "./demo.sh run <файл.js>      виконати готовий скрипт із папки scripts/"
    echo "./demo.sh load-sample <файл> завантажити sample_airbnb і sample_geospatial з архіву Atlas"
    echo "./demo.sh compass            відкрити ті самі дані в MongoDB Compass (GUI)"
    echo "./demo.sh down               зупинити й видалити дані"
    ;;
esac
