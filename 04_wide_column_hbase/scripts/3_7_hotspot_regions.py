"""Бонус до частини 3: hotspotting на справжніх регіонах.

У standalone HBase нова таблиця має ОДИН регіон, тож у 3.1–3.2 «регіони» лише уявні.
Тут три таблиці заздалегідь розбиті на 4 регіони (3_6_hotspot.hbase). Пишемо в кожну
ті самі 3000 логів трьох серверів з різними Row Key і рахуємо рядки в кожному регіоні:

  hot_ts      timestamp_server                    — як logs_bad
  hot_server  md5(server)%4 : server : reversed_ts — як logs_good (сіль від server_id)
  hot_salted  md5(ts)%4 : server : reversed_ts     — сіль від timestamp (класичний salting)

Запуск: ./demo.sh hotspot   (сам створює таблиці; потім ./demo.sh regions — запити по регіонах)
"""
import hashlib
import os
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')
N = 3000
NUM_BUCKETS = 4


def bucket(text: str) -> int:
    return int(hashlib.md5(text.encode()).hexdigest(), 16) % NUM_BUCKETS


KEYS = {
    'hot_ts':     lambda server, ts: f"{ts}_{server}",
    'hot_server': lambda server, ts: f"{bucket(server)}:{server}:{9_999_999_999_999 - ts}",
    'hot_salted': lambda server, ts: f"{bucket(str(ts))}:{server}:{9_999_999_999_999 - ts}",
}
servers = ['web-01', 'web-02', 'web-03']

conn = happybase.Connection(HOST, port=9090)
conn.open()

for name, make_key in KEYS.items():
    table = conn.table(name)
    with table.batch(batch_size=500) as batch:
        for i in range(N):
            server = servers[i % 3]
            # Фіксований час замість time.time(), щоб ключі збігалися з README:
            # 1744000000000 мс = 2025-04-07 04:26:40 UTC; кожен наступний лог на 1 с пізніше
            ts = 1744000000000 + i * 1000
            batch.put(make_key(server, ts).encode(), {b'log:server': server.encode()})

    print(f"\n{name}   приклад ключа: {make_key('web-01', 1744000000000)}")
    for region in table.regions():
        start, end = region['start_key'], region['end_key']
        rows = sum(1 for _ in table.scan(row_start=start or None, row_stop=end or None,
                                         columns=[b'log:server']))
        bar = '#' * (rows // 100)
        print(f"  регіон [{start.decode() or '-∞':>3} .. {end.decode() or '+∞':<3})  "
              f"{rows:5d} рядків  {bar}")

# Ціна класичного salting: логи одного сервера розкидані по всіх кошиках
print("\nЧитання останніх логів web-01:")
print("  hot_server: 1 range-scan (префікс відомий)")
print(f"  hot_salted: {NUM_BUCKETS} range-scan'и (по одному на кошик) + злиття на клієнті")

conn.close()
