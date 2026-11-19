"""Частина 3.1 (підготовка): перестворюємо таблиці logs_bad і logs_good.

Запуск: ./demo.sh run 3_1_setup_logs.py
"""
import os
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()

# Підготовка: видаляємо таблицю якщо є
for table_name in [b'logs_bad', b'logs_good']:
    if table_name in conn.tables():
        conn.disable_table(table_name)
        conn.delete_table(table_name)

conn.create_table('logs_bad', {'log': dict(max_versions=1)})
conn.create_table('logs_good', {'log': dict(max_versions=1)})
print("Таблиці створені")
conn.close()
