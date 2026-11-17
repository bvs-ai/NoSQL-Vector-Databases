// Частина 2, крок 1: початковий стан складу. Запуск: ./demo.sh 2.1
// Кроки 2.2–2.4 самі завантажують цей файл на початку (load), тож кожен з них
// стартує з однакового стану і їх можна запускати повторно та в будь-якому порядку.
db = db.getSiblingDB("shop")

db.inventory.drop()
db.orders.drop()

db.inventory.insertOne({ sku: "WIDGET-500", name: "Розумний віджет", quantity: 10, reserved: 0 })
db.inventory.insertOne({ sku: "GADGET-100", name: "Гаджет", quantity: 3, reserved: 0 })
db.createCollection("orders")

print("Початковий стан складу:")
db.inventory.find({}, { _id: 0, name: 0 }).forEach(d => print("  ", JSON.stringify(d)))
