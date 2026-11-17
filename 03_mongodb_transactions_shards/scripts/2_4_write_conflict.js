// Частина 2, крок 4: WriteConflict — дві транзакції змінюють один документ. Запуск: ./demo.sh 2.4
// У сценарії заняття це два термінали (A і B). Тут обидві сесії в одному скрипті, у тому самому
// порядку:  A оновлює й НЕ комітить  →  B пробує оновити той самий документ  →  A комітить.
load("/scripts/2_1_setup.js")   // склад знову: GADGET-100 — 3 шт. (останні)

// ---- Покупець A ----
const sessionA = db.getMongo().startSession()
sessionA.startTransaction()
const invA = sessionA.getDatabase("shop").inventory

print("\nA: бачить залишок", invA.findOne({ sku: "GADGET-100" }).quantity)
invA.updateOne({ sku: "GADGET-100" }, { $inc: { quantity: -3 } })
print("A: купив 3 шт., але commit ще не зробив")

// ---- Покупець B (поки A не закомітив) ----
const sessionB = db.getMongo().startSession()
sessionB.startTransaction()
const invB = sessionB.getDatabase("shop").inventory

try {
  print("B: бачить залишок", invB.findOne({ sku: "GADGET-100" }).quantity, "(змін A ще не видно)")
  invB.updateOne({ sku: "GADGET-100" }, { $inc: { quantity: -3 } })
  sessionB.commitTransaction()
  print("B: успішно!")
} catch (e) {
  print("B: помилка", e.codeName, "| мітки:", JSON.stringify(e.errorLabels))
  sessionB.abortTransaction()
} finally {
  sessionB.endSession()
}

// ---- Покупець A — завершити ----
sessionA.commitTransaction()
print("A: commit")
sessionA.endSession()

print("Склад:", JSON.stringify(db.inventory.findOne({ sku: "GADGET-100" }, { _id: 0, name: 0 })), " ← 0, а не -3")
