"""Частина 2.3: завантаження movies.csv у таблицю 'movies' через batch.

Запуск: ./demo.sh run 2_1_load_movies.py   (з хоста: python 2_1_load_movies.py)
Очікуємо: таблиця перестворена, 10 рядків «Додано: movie_0NN — назва».
"""
import csv
import os
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')   # у контейнері client — 'hbase'

# Підключення до HBase через Thrift API
conn = happybase.Connection(HOST, port=9090)
conn.open()

TABLE_NAME = 'movies'

# Видаляємо таблицю якщо вже існує (для чистоти експерименту)
if TABLE_NAME.encode() in conn.tables():
    print(f"Таблиця '{TABLE_NAME}' вже існує, видаляємо...")
    conn.disable_table(TABLE_NAME)
    conn.delete_table(TABLE_NAME)

# Створюємо таблицю з двома Column Families
conn.create_table(
    TABLE_NAME,
    {
        'info': dict(max_versions=1),
        'meta': dict(max_versions=1),
    }
)
print(f"Таблиця '{TABLE_NAME}' створена")

table = conn.table(TABLE_NAME)

# Завантажуємо дані з CSV через batch для ефективності
print("Завантажуємо дані з movies.csv...")

with open('movies.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)

    # batch_size=100: відправляємо дані на сервер пачками по 100 рядків
    # (у нас лише 10 рядків — вони підуть одним запитом при виході з with)
    with table.batch(batch_size=100) as batch:
        for row in reader:
            row_key = row['movie_id'].encode()
            batch.put(row_key, {
                b'info:title':    row['title'].encode(),
                b'info:genre':    row['genre'].encode(),
                b'info:year':     row['year'].encode(),
                b'info:rating':   row['rating'].encode(),
                b'meta:director': row['director'].encode(),
            })
            print(f"  Додано: {row['movie_id']} — {row['title']}")

print("\nДані успішно завантажені!")

conn.close()
