"""Частина 3.1: логи з ПОГАНИМ Row Key — timestamp на початку.

Запуск: ./demo.sh run 3_2_logs_bad.py   (спершу 3_1_setup_logs.py)
Очікуємо: 15 ключів 1744000000000_web-01 ... строго за зростанням.
"""
import os
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()
table = conn.table('logs_bad')

# Імітуємо логи трьох серверів
servers = ['web-01', 'web-02', 'web-03']
messages = [
    'Request received',
    'Database query executed',
    'Response sent',
    'Cache miss',
    'User authenticated',
]

print("Записуємо логи з ПОГАНИМ Row Key: timestamp_server_id")
print("Формат ключа: 1744000001000_web-01\n")

with table.batch() as batch:
    for i in range(15):
        server = servers[i % 3]
        message = messages[i % 5]
        # ПОГАНИЙ ДИЗАЙН: timestamp на початку
        # Всі нові записи мають ключі більші за попередні
        # → всі пишуться в один (останній) регіон
        # Фіксований час замість time.time(), щоб ключі збігалися з README:
        # 1744000000000 мс = 2025-04-07 04:26:40 UTC; кожен наступний лог на 1 с пізніше
        ts = 1744000000000 + (i * 1000)
        row_key = f"{ts}_{server}".encode()
        batch.put(row_key, {
            b'log:server': server.encode(),
            b'log:message': message.encode(),
            b'log:level': b'INFO',
        })

print("Дані записані. Подивимось на порядок ключів:\n")

for key, data in table.scan():
    print(f"  {key.decode()}")

conn.close()
