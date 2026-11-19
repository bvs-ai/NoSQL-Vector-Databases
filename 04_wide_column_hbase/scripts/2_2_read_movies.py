"""Крок 2.2: читання фільмів — row, rows, scan з колонками, фільтр на клієнті і на сервері.

Запуск: ./demo.sh run 2_2_read_movies.py   (спершу 2_1_load_movies.py)
"""
import os
import happybase

HOST = os.environ.get('HBASE_HOST', 'localhost')

conn = happybase.Connection(HOST, port=9090)
conn.open()
table = conn.table('movies')

# ──────────────────────────────────────────────────────────────────────
# 1. Один рядок за ключем: table.row()
# ──────────────────────────────────────────────────────────────────────
print("=" * 50)
print("1. Читаємо один фільм за ID")
print("=" * 50)

row = table.row(b'movie_001')
print(f"Заголовок: {row[b'info:title'].decode()}")
print(f"Жанр:      {row[b'info:genre'].decode()}")
print(f"Рік:       {row[b'info:year'].decode()}")
print(f"Рейтинг:   {row[b'info:rating'].decode()}")
print(f"Режисер:   {row[b'meta:director'].decode()}")

# ──────────────────────────────────────────────────────────────────────
# 2. Кілька рядків за списком ключів: table.rows()
# ──────────────────────────────────────────────────────────────────────
print()
print("=" * 50)
print("2. Читаємо кілька фільмів одразу")
print("=" * 50)

keys = [b'movie_002', b'movie_005', b'movie_009']
rows = table.rows(keys)

for key, data in rows:
    title = data[b'info:title'].decode()
    rating = data[b'info:rating'].decode()
    print(f"{key.decode()}: {title} (рейтинг: {rating})")

# ──────────────────────────────────────────────────────────────────────
# 3. Scan усієї таблиці, лише потрібні колонки: table.scan(columns=...)
# ──────────────────────────────────────────────────────────────────────
print()
print("=" * 50)
print("3. Скануємо всі фільми, виводимо тільки назву і рейтинг")
print("=" * 50)

for key, data in table.scan(columns=[b'info:title', b'info:rating']):
    title = data.get(b'info:title', b'').decode()
    rating = data.get(b'info:rating', b'').decode()
    print(f"{key.decode()}: {title} — {rating}")

# ──────────────────────────────────────────────────────────────────────
# 4. Фільтр за значенням — тільки на клієнті (WHERE у HBase немає)
# ──────────────────────────────────────────────────────────────────────
print()
print("=" * 50)
print("4. Фільтрація на стороні клієнта: фільми з рейтингом >= 8.9")
print("=" * 50)

# Важливий момент: HBase зберігає байти і не знає, що '8.9' — число.
# Ми читаємо всі рядки і фільтруємо в Python.
# У реальних системах це вирішується через дизайн Row Key.
top_movies = []
scanned = 0
for key, data in table.scan(columns=[b'info:title', b'info:rating']):
    scanned += 1
    rating = float(data.get(b'info:rating', b'0').decode())
    title = data.get(b'info:title', b'').decode()
    if rating >= 8.9:
        top_movies.append((rating, title))

top_movies.sort(reverse=True)
for rating, title in top_movies:
    print(f"{rating} — {title}")
print(f"(прочитано з сервера рядків: {scanned}, знайдено: {len(top_movies)})")

# ──────────────────────────────────────────────────────────────────────
# 5. Те саме з серверним фільтром: table.scan(filter=...)
# ──────────────────────────────────────────────────────────────────────
# Фільтр — рядок мовою HBase Filter Language, його виконує RegionServer.
# Клієнт отримує лише рядки, що пройшли фільтр. Але сервер усе одно
# перебирає всю таблицю: економимо мережу, а не читання (індексу немає).
#
# SingleColumnValueFilter('cf', 'col', оператор, 'binary:значення', true, true)
#   binary: — побайтове порівняння рядків, не чисел: '9.0' > '8.9' працює,
#             бо всі рейтинги мають формат X.Y ('10.0' вже зламав би порядок)
#   true, true — filterIfMissing (рядки без колонки відкинути)
#                і latestVersionOnly (дивитися лише останню версію)
print()
print("=" * 50)
print("5. Серверний фільтр: той самий запит, що в п. 4")
print("=" * 50)

rating_filter = "SingleColumnValueFilter('info', 'rating', >=, 'binary:8.9', true, true)"
print(f"filter = {rating_filter}")
received = 0
for key, data in table.scan(columns=[b'info:title', b'info:rating'], filter=rating_filter):
    received += 1
    print(f"{data[b'info:rating'].decode()} — {data[b'info:title'].decode()}")
print(f"(отримано з сервера рядків: {received})")

conn.close()
