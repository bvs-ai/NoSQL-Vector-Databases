// Частина 2, крок 2: дві операції БЕЗ транзакції, "падіння" між ними. Запуск: ./demo.sh 2.2
load("/scripts/2_1_setup.js")   // склад знову: WIDGET-500 — 10 шт.

try {
  // Сценарій: купуємо 5 віджетів
  // Операція 1 — списуємо зі складу
  db.inventory.updateOne(
    { sku: "WIDGET-500" },
    { $inc: { quantity: -5, reserved: 5 } }
  )

  // 💥 Симулюємо падіння МІЖ двома операціями
  throw new Error("Сервер впав у найневідповідніший момент!")

  // Операція 2 — створюємо замовлення. Цей код вже не виконається:
  db.orders.insertOne({
    orderId: "ORD-BROKEN",
    items: [{ sku: "WIDGET-500", qty: 5 }],
    status: "placed"
  })
} catch (e) {
  print("💥", e.message)
}

// Дивимося на підсумок катастрофи
print("Склад:    ", JSON.stringify(db.inventory.findOne({ sku: "WIDGET-500" }, { _id: 0, name: 0 })))
print("Замовлень:", db.orders.countDocuments({ orderId: "ORD-BROKEN" }), " ← товар списано, а замовлення немає")
