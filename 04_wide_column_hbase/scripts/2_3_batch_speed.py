"""Частина 2: звичайний put проти batch — N рядків, порівняння часу.

Запуск: ./demo.sh run 2_3_batch_speed.py
Числа залежать від машини; важливе — у скільки разів batch швидший.
"""
import os
import time
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()

# Створюємо тимчасову таблицю для тесту
if b'speed_test' in conn.tables():
    conn.disable_table('speed_test')
    conn.delete_table('speed_test')
conn.create_table('speed_test', {'d': {}})
table = conn.table('speed_test')

N = 500

# Звичайний запис — кожен put окремий мережевий запит
start = time.time()
for i in range(N):
    table.put(
        f'row_{i:05d}'.encode(),
        {b'd:v': str(i).encode()}
    )
elapsed_single = time.time() - start
print(f"Звичайний запис {N} рядків: {elapsed_single:.2f} сек "
      f"({elapsed_single / N * 1000:.2f} мс/рядок)")

# Видаляємо і створюємо знову для чистоти
conn.disable_table('speed_test')
conn.delete_table('speed_test')
conn.create_table('speed_test', {'d': {}})
table = conn.table('speed_test')

# Batch запис — всі put групуються і відправляються пачками по 100
start = time.time()
with table.batch(batch_size=100) as batch:
    for i in range(N):
        batch.put(
            f'row_{i:05d}'.encode(),
            {b'd:v': str(i).encode()}
        )
elapsed_batch = time.time() - start
print(f"Batch запис {N} рядків:     {elapsed_batch:.2f} сек "
      f"({elapsed_batch / N * 1000:.2f} мс/рядок)")

speedup = elapsed_single / elapsed_batch
print(f"\nBatch швидший у {speedup:.1f} разів")

conn.close()
