#!/usr/bin/env bash
# Пульт навчального кластера MongoDB (replica set rs0). Без аргументів — довідка.
set -euo pipefail
cd "$(dirname "$0")"

NODES=(mongo1 mongo2 mongo3)

# Windows (Git Bash): не перетворювати шляхи /scripts/... на C:/...; інтерактив — через winpty.
export MSYS_NO_PATHCONV=1
TTY=(docker exec -it)
if [ -n "${MSYSTEM:-}" ] && command -v winpty >/dev/null; then TTY=(winpty docker exec -it); fi

msh() { docker exec "$1" mongosh --quiet --eval "$2"; }   # виконати JS на вузлі

cmd_up() {
  docker compose up -d --build
  for n in "${NODES[@]}"; do
    until msh "$n" 'db.adminCommand({ping: 1}).ok' >/dev/null 2>&1; do sleep 1; done
  done
  # priority 2 у mongo1: після старту й після збоїв primary завжди mongo1 — так простіше стежити.
  msh mongo1 '
    try { rs.status() } catch (e) {
      rs.initiate({_id: "rs0", members: [
        {_id: 0, host: "mongo1:27017", priority: 2},
        {_id: 1, host: "mongo2:27017"},
        {_id: 2, host: "mongo3:27017"}]}) }' >/dev/null
  until [ "$(msh mongo1 'db.hello().isWritablePrimary' 2>/dev/null)" = "true" ]; do sleep 1; done
  msh mongo1 'db.getSiblingDB("shop").items.replaceOne({_id: 1}, {_id: 1, status: "NEW"}, {upsert: true})' >/dev/null
  cmd_status
}

cmd_status() {  # кожен вузол відповідає сам за себе
  for n in "${NODES[@]}"; do
    msh "$n" 'const me = rs.status().members.find(m => m.self);
              print(me.name.split(":")[0], " ", me.stateStr)' 2>/dev/null \
      || echo "$n   недоступний"
  done
}

cmd_delay() {  # delay <вузол> <мс> — затримка всього вихідного трафіку вузла
  docker exec "$1" tc qdisc replace dev eth0 root netem delay "$2ms"
  echo "$1: вихідний трафік затримується на $2 мс"
}

cmd_isolate() {  # isolate <вузол> — вузол живий, але не бачить двох інших
  local peer ip
  for peer in "${NODES[@]}"; do
    [ "$peer" = "$1" ] && continue
    ip=$(docker exec "$1" getent hosts "$peer" | awk '{print $1}')
    docker exec "$1" iptables -A INPUT  -s "$ip" -j DROP
    docker exec "$1" iptables -A OUTPUT -d "$ip" -j DROP
  done
  echo "$1 відрізано від інших вузлів"
}

cmd_heal() {
  for n in "${NODES[@]}"; do
    docker exec "$n" iptables -F 2>/dev/null || true
    docker exec "$n" tc qdisc del dev eth0 root 2>/dev/null || true
  done
  echo "Мережу відновлено"
}

cmd_stop()  { docker stop "$@" >/dev/null && echo "зупинено: $*"; }
cmd_start() { docker start "$@" >/dev/null && echo "запущено: $*"; }
cmd_shell() { "${TTY[@]}" "${1:-mongo1}" mongosh shop; }
cmd_watch() { "${TTY[@]}" "${1:-mongo2}" mongosh --quiet /scripts/watch.js; }
cmd_down()  { docker compose down -v; }

usage() {
  cat <<'EOF'
./lab.sh <команда>
  up                  підняти 3 вузли і replica set (primary — mongo1)
  status              роль кожного вузла
  shell [вузол]       mongosh на вузлі (за замовчуванням mongo1)
  watch [вузол]       читати shop.items кожні 0.3 с (за замовчуванням mongo2)
  delay <вузол> <мс>  мережева затримка
  isolate <вузол>     відрізати вузол від інших
  heal                прибрати затримки й розрив
  stop <вузли...>     зупинити вузли
  start <вузли...>    запустити вузли
  down                зупинити все й видалити дані
EOF
}

c=${1:-}; shift || true
case "$c" in
  up|status|shell|watch|delay|isolate|heal|stop|start|down) "cmd_$c" "$@" ;;
  *) usage ;;
esac
