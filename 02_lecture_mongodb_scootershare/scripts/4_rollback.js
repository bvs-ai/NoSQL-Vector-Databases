// Завдання 4.2: другий крок транзакції навмисно падає — перший має відкотитися.
const SCOOTER_ID = "sc-003";
const USER_ID    = "user_042";

const session = db.getMongo().startSession();

try {
  session.withTransaction(() => {
    const scooters = session.getDatabase(db.getName()).scooters;
    const trips    = session.getDatabase(db.getName()).trips;

    // Крок 1: змінюємо статус
    const result = scooters.updateOne(
      { _id: SCOOTER_ID, status: "free" },
      { $set: { status: "busy" } }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Самокат ${SCOOTER_ID} недоступний`);
    }

    print("Крок 1 виконано: статус змінено на busy");
    // Усередині транзакції зміна вже видна:
    print("  у транзакції:  " + scooters.findOne({ _id: SCOOTER_ID }).status);
    // А ззовні (без сесії) — ні:
    print("  поза транзакцією: " + db.scooters.findOne({ _id: SCOOTER_ID }).status);

    // 💥 Симулюємо збій
    throw new Error("💥 Симуляція збою мережі / помилки бізнес-логіки");

    // (не виконається)
    trips.insertOne({ user_id: USER_ID, scooter_id: SCOOTER_ID, status: "active" });

  }, {
    readConcern:  { level: "snapshot" },
    writeConcern: { w: "majority" }
  });

  print("✅ Транзакція успішно завершена");

} catch (err) {
  print(`❌ Транзакцію скасовано: ${err.message}`);

} finally {
  session.endSession();
}

// Перевірка після відкату
printjson(db.scooters.findOne({ _id: SCOOTER_ID }, { status: 1 }));          // free
printjson(db.trips.findOne({ scooter_id: SCOOTER_ID, status: "active" }));   // null
