// Частина 1, крок 1: хто зараз Primary. Запуск: ./demo.sh 1.1
// Запускайте цей крок щоразу, коли хочете побачити стан replica set (після kill, після revive).
db = db.getSiblingDB("test")

rs.status().members.forEach(m => print(m.name, m.stateStr))
print("Зараз Primary:", db.hello().primary)
print("Замовлень у test.orders:", db.orders.countDocuments())
