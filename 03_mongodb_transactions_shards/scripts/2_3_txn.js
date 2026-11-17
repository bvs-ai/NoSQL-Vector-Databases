// Частина 2, крок 3: та сама покупка, але В ТРАНЗАКЦІЇ. Запуск: ./demo.sh 2.3
// Функція buyWidgets викликається двічі: спершу зі збоєм посередині, потім без нього.
load("/scripts/2_1_setup.js")   // склад знову: WIDGET-500 — 10 шт.

function buyWidgets(simulateCrash) {
  const session = db.getMongo().startSession()

  const txnOptions = {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" }
  }

  try {
    session.withTransaction(() => {
      // Усе, що зроблено через session, належить транзакції
      const inv = session.getDatabase("shop").inventory
      const ord = session.getDatabase("shop").orders

      // Перевіряємо наявність товару
      const item = inv.findOne({ sku: "WIDGET-500" })
      print("Поточний залишок:", item.quantity)
      if (item.quantity < 5) {
        print("❌ Недостатньо товару!")
        return
      }

      // Операція 1 — списуємо зі складу
      inv.updateOne(
        { sku: "WIDGET-500" },
        { $inc: { quantity: -5, reserved: 5 } }
      )
      print("Після списання: усередині транзакції залишок", inv.findOne({ sku: "WIDGET-500" }).quantity,
            "| поза транзакцією", db.inventory.findOne({ sku: "WIDGET-500" }).quantity)

      // 💥 Той самий збій між двома операціями, що й у кроці 2.2
      if (simulateCrash) throw new Error("Все ще падаємо, але результат буде іншим")

      // Операція 2 — створюємо замовлення
      ord.insertOne(
        { orderId: "ORD-999", items: [{ sku: "WIDGET-500", qty: 5 }], status: "placed" }
      )
      print("✅ Замовлення створено!")
    }, txnOptions)
  } catch (e) {
    print("🔄 Транзакція відкотилася:", e.message)
  } finally {
    session.endSession()
  }

  // Підсумок: обидві колекції
  print("Склад:    ", JSON.stringify(db.inventory.findOne({ sku: "WIDGET-500" }, { _id: 0, name: 0 })))
  print("Замовлень:", db.orders.countDocuments({ orderId: "ORD-999" }))
}

print("\n── Спроба 1: збій усередині транзакції ──")
buyWidgets(true)

print("\n── Спроба 2: без збою ──")
buyWidgets(false)
