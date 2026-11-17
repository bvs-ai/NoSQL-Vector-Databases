// Частина 1, крок 3, термінал 1: безперервна вставка замовлень. Запуск: ./demo.sh 1.3
// У терміналі 2 в цей час: ./demo.sh kill. Зупинка циклу: Ctrl+C.
//
// Клієнт підключений до ВСЬОГО replica set, тому після падіння Primary драйвер
// сам знаходить нового і повторює запис (retryable writes) — помилки не буде, лише пауза.
// ./demo.sh 1.3 raw вимикає цей повтор, і тоді спрацьовує catch.
db = db.getSiblingDB("test")
const time = () => new Date().toISOString().slice(11, 19)   // ГГ:ХХ:СС (UTC) — щоб бачити паузу

let i = 100
while (true) {
  try {
    db.orders.insertOne(
      { orderId: "ORD-" + i, item: "Item-" + i, total: i * 10, ts: new Date() },
      { writeConcern: { w: "majority" } }
    )
    print(time(), "Вставлено замовлення ORD-" + i)
    i++
    sleep(300)
  } catch (e) {
    print(time(), "❌ ПОМИЛКА:", e.message)
    sleep(1000)
  }
}
