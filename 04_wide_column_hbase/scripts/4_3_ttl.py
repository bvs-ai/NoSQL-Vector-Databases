"""Частина 4.2: TTL = 5 с на CF 'session', CF 'user' без TTL.

Запуск: ./demo.sh run 4_3_ttl.py
Очікуємо: одразу — 4 колонки; через 6 с — лише user:* (рядок НЕ порожній,
бо TTL діє на Column Family, а 'user' без TTL).
"""
import os
import time
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()

# Створюємо таблицю з TTL = 5 секунд для CF 'session'
# Це навчальний приклад — у реальності TTL зазвичай години або дні
if b'sessions' in conn.tables():
    conn.disable_table('sessions')
    conn.delete_table('sessions')

conn.create_table(
    'sessions',
    {
        'session': dict(time_to_live=5),   # Закінчується через 5 секунд
        'user':    dict(),                  # Без TTL — зберігається вічно
    }
)
table = conn.table('sessions')

print("Створюємо сесію користувача...")
table.put(
    b'sess_abc123',
    {
        b'session:token':      b'eyJhbGciOiJIUzI1NiJ9',
        b'session:ip':         b'192.168.1.100',
        b'user:user_id':       b'user_42',
        b'user:username':      b'ivan_petrov',
    }
)
print("Сесія записана\n")

# Читаємо одразу після запису
print("Читаємо одразу:")
row = table.row(b'sess_abc123')
for col, val in row.items():
    print(f"  {col.decode()}: {val.decode()}")

print("\nЧекаємо 6 секунд (TTL = 5 сек)...")
time.sleep(6)

print("\nЧитаємо після закінчення TTL:")
row = table.row(b'sess_abc123')
if row:
    for col, val in row.items():
        print(f"  {col.decode()}: {val.decode()}")
else:
    print("  Рядок порожній — всі дані з TTL зникли")

conn.close()
