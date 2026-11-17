// Частина 1, крок 4: читання з Secondary. Запуск: ./demo.sh 1.4
// (demo.sh сам знаходить Secondary і запускає цей скрипт напряму на ньому.)
db = db.getSiblingDB("test")

// ── А. Ми підключені НАПРЯМУ до одного вузла, і це Secondary ──
print("А. Пряме підключення до", db.hello().me, "| isWritablePrimary:", db.hello().isWritablePrimary)

print("   читання → прочитано документів:", db.orders.find().limit(3).toArray().length)

try {
  db.orders.insertOne({ orderId: "FROM-SECONDARY" })
} catch (e) {
  print("   запис   → помилка:", e.codeName)
}

// ── Б. Підключення до ВСЬОГО replica set: read preference вирішує, який вузол відповість ──
print("Б. Підключення до всього replica set — хто відповідає на find():")
const conn = new Mongo("mongodb://mongo1,mongo2,mongo3/?replicaSet=rs0")
const orders = conn.getDB("test").orders
const answeredBy = (cursor) => cursor.explain().serverInfo.host

print("   за замовчуванням (primary)           →", answeredBy(orders.find()))

// Для конкретного запиту:
print("   .readPref('secondaryPreferred')      →", answeredBy(orders.find({ status: "pending" }).readPref("secondaryPreferred")))

// Для всього з'єднання:
conn.setReadPref("secondary")
print("   після conn.setReadPref('secondary')  →", answeredBy(orders.find()))
