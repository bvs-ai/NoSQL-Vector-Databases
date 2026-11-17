// Частина 1, крок 2: w:1 проти w:"majority". Запуск: ./demo.sh 1.2
db = db.getSiblingDB("test")

// ---- Варіант А: w:1 (підтвердження тільки від Primary) ----
let t1 = Date.now()
db.orders.insertOne(
  { orderId: "ORD-001", item: "Laptop", total: 1299, status: "pending" },
  { writeConcern: { w: 1 } }
)
print("w:1 зайняло:", Date.now() - t1, "мс")

// ---- Варіант Б: w:"majority" (підтвердження від більшості вузлів) ----
let t2 = Date.now()
db.orders.insertOne(
  { orderId: "ORD-002", item: "Monitor", total: 499, status: "pending" },
  { writeConcern: { w: "majority", j: true, wtimeout: 5000 } }
)
print("w:majority зайняло:", Date.now() - t2, "мс")

// ---- Один замір — це шум (перша вставка ще й "прогріває" з'єднання).
// ---- Тому те саме 20 разів поспіль: тут різницю видно.
const N = 20
for (const wc of [{ w: 1 }, { w: "majority", j: true }]) {
  const t = Date.now()
  for (let k = 0; k < N; k++) {
    db.orders.insertOne({ orderId: "BENCH-" + k, total: k }, { writeConcern: wc })
  }
  print(N + " вставок з", JSON.stringify(wc), "→", Date.now() - t, "мс")
}
db.orders.deleteMany({ orderId: /^BENCH-/ })
