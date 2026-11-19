"""Частина 4.1: читаємо поточну версію та всю доступну історію ціни.

Запуск: ./demo.sh run 4_2_versions_read.py   (спершу 4_1_versions_write.py)
Очікуємо: поточна 1300; історія — 5 версій (1300 … 1100), 1000 уже не повертається.
"""
import os
from datetime import datetime
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()

table = conn.table('versioned')

# Читаємо 1 (останню) версію — поведінка за замовчуванням
print("Поточна ціна (остання версія):")
row = table.row(b'product_001')
print(f"  {row[b'data:price'].decode()} USD\n")

# Читаємо всі версії з часовими мітками (просимо 10 — HBase віддасть не більше 5)
print("Історія змін ціни (всі доступні версії):")
versions = table.cells(
    b'product_001',
    b'data:price',
    versions=10,
    include_timestamp=True
)

for value, timestamp in versions:
    dt = datetime.fromtimestamp(timestamp / 1000)
    print(f"  {dt.strftime('%H:%M:%S.%f')[:-3]}  → {value.decode()} USD")
print(f"\nВерсій повернуто: {len(versions)}")

conn.close()
