"""Частина 3.3: читаємо останні логи одного сервера range-scan'ом по його префіксу.

Запуск: ./demo.sh run 3_4_read_logs.py   (спершу 3_3_logs_good.py)
Очікуємо: по 5 логів на сервер, від найсвіжішого.
"""
import hashlib
import os
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()
table = conn.table('logs_good')

NUM_BUCKETS = 4


def get_server_logs(table, server_id: str, limit: int = 10):
    """
    Читаємо останні N логів для конкретного сервера.

    Оскільки сіль детермінована від server_id, ми точно знаємо,
    з якого префікса починаються його ключі. Скануємо лише цей діапазон,
    а не всю таблицю.
    """
    # Обчислюємо сіль — ту саму формулу, що при записі
    h = hashlib.md5(server_id.encode()).hexdigest()
    salt = int(h, 16) % NUM_BUCKETS

    # Діапазон: всі ключі для цього сервера в цьому кошику
    row_start = f"{salt}:{server_id}:".encode()
    row_stop = f"{salt}:{server_id};".encode()  # ';' > ':' в ASCII
    # У реальному коді межі руками не рахують — happybase зробить те саме сам:
    #   table.scan(row_prefix=f"{salt}:{server_id}:".encode(), limit=limit)

    results = []
    for key, data in table.scan(row_start=row_start,
                                row_stop=row_stop,
                                limit=limit):
        results.append({
            'key':     key.decode(),
            'server':  data.get(b'log:server', b'').decode(),
            'message': data.get(b'log:message', b'').decode(),
        })
    return results


# Читаємо логи для кожного сервера
for server in ['web-01', 'web-02', 'web-03']:
    print(f"\nОстанні логи для {server}:")
    logs = get_server_logs(table, server, limit=5)
    if logs:
        for entry in logs:
            print(f"  {entry['key']}  [{entry['server']}] {entry['message']}")
    else:
        print("  (логів немає)")

conn.close()
