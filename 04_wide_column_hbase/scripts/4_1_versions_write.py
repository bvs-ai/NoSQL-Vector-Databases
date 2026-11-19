"""Частина 4.1: 6 версій однієї комірки в CF з max_versions=5.

Запуск: ./demo.sh run 4_1_versions_write.py, потім 4_2_versions_read.py
"""
import os
import time
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()

# Створюємо таблицю зі зберіганням до 5 версій для CF 'data'
if b'versioned' in conn.tables():
    conn.disable_table('versioned')
    conn.delete_table('versioned')

conn.create_table(
    'versioned',
    {'data': dict(max_versions=5)}
)
table = conn.table('versioned')

print("Записуємо 6 версій однієї комірки з паузою 0.3 сек між ними\n")

# Емулюємо історію зміни ціни товару
prices = [1000, 1100, 950, 1200, 1050, 1300]
for price in prices:
    table.put(
        b'product_001',
        {b'data:price': str(price).encode()}
    )
    print(f"  Записана ціна: {price} USD")
    time.sleep(0.3)

conn.close()
