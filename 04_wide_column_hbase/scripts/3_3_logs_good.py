"""Частина 3.2: логи з Row Key salt:server_id:reversed_timestamp.

Запуск: ./demo.sh run 3_3_logs_good.py   (спершу 3_1_setup_logs.py)
Очікуємо: кошики web-01 → 2, web-02 → 1, web-03 → 1 (так, двоє серверів в одному кошику —
сіль від server_id з 4 кошиків для 3 серверів не гарантує різних кошиків).
Всередині сервера ключі йдуть від свіжих до старих.
"""
import hashlib
import os
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()
table = conn.table('logs_good')

NUM_BUCKETS = 4  # Кількість "кошиків" для розподілу


def get_salt(server_id: str) -> int:
    """Сіль: детермінований хеш від server_id → номер кошика 0..NUM_BUCKETS-1.
    Один і той самий сервер ЗАВЖДИ отримує однакову сіль."""
    h = hashlib.md5(server_id.encode()).hexdigest()
    return int(h, 16) % NUM_BUCKETS


def make_salted_key(server_id: str, timestamp: int) -> bytes:
    """
    Створюємо ключ: salt:server_id:reversed_timestamp

    Три ідеї в одному ключі:
    1. Сіль (від server_id) — розносить РІЗНІ сервери по регіонах
    2. server_id — групує логи одного сервера разом
    3. Зворотний timestamp — останні логи читаються першими
    """
    salt = get_salt(server_id)

    # Зворотний timestamp: віднімаємо від великого числа
    # Чим пізніше подія, тим менше це число
    # → при scan першими йдуть СВІЖІ логи
    reversed_ts = 9_999_999_999_999 - timestamp

    return f"{salt:01d}:{server_id}:{reversed_ts}".encode()


servers = ['web-01', 'web-02', 'web-03']
messages = [
    'Request received',
    'Database query executed',
    'Response sent',
    'Cache miss',
    'User authenticated',
]

print("Записуємо логи з ГАРНИМ Row Key: salt:server_id:reversed_timestamp\n")

# Показуємо, яку сіль отримає кожен сервер
print("Розподіл серверів по кошиках:")
for server in servers:
    print(f"  {server} → кошик {get_salt(server)}")
print()

with table.batch() as batch:
    for i in range(15):
        server = servers[i % 3]
        message = messages[i % 5]
        # Фіксований час замість time.time(), щоб ключі збігалися з README:
        # 1744000000000 мс = 2025-04-07 04:26:40 UTC; кожен наступний лог на 1 с пізніше
        ts = 1744000000000 + (i * 1000)
        row_key = make_salted_key(server, ts)
        batch.put(row_key, {
            b'log:server': server.encode(),
            b'log:message': message.encode(),
            b'log:level': b'INFO',
        })

print("Дані записані. Подивимось на порядок ключів:\n")

for key, data in table.scan():
    print(f"  {key.decode()}")

conn.close()
