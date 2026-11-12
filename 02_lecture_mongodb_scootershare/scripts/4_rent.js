// Завдання 4.1: атомарна оренда самоката (оновити scooters + створити trips в одній транзакції).
const SCOOTER_ID = "sc-003";
const USER_ID    = "user_042";
const session = db.getMongo().startSession();

try {
  session.withTransaction(() => {
    const scooters = session.getDatabase(db.getName()).scooters;   // та сама база, що й у частинах 1–3
    const trips    = session.getDatabase(db.getName()).trips;

    const result = scooters.updateOne(
      { _id: SCOOTER_ID, status: "free" },
      { $set: { status: "busy" } }
    );

    if (result.matchedCount === 0) {
      throw new Error("Самокат зайнятий");
    }

    trips.insertOne({
      user_id: USER_ID,
      scooter_id: SCOOTER_ID,
      status: "active",
      date: new Date(),
      price: 0
    });
  });

  print("✅ Успішно");

} catch (e) {
  print("❌ Помилка: " + e.message);
} finally {
  session.endSession();
}

// Перевірка
printjson(db.scooters.findOne({ _id: SCOOTER_ID }, { status: 1 }));
printjson(db.trips.findOne({ scooter_id: SCOOTER_ID, status: "active" }));
