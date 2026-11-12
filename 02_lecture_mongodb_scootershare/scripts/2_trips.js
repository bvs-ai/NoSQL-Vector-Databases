// Частина 2. Генератор тестових поїздок: 5000 поїздок, 50 користувачів, 12 самокатів.
// Повторний запуск безпечний: колекція перестворюється (індекси теж зникають).
db.trips.drop();

const USERS = Array.from({ length: 50 }, (_, i) => `user_${String(i + 1).padStart(3, "0")}`);
const SCOOTERS = Array.from({ length: 12 }, (_, i) => `sc-${String(i + 1).padStart(3, "0")}`);
const STATUSES = ["completed", "completed", "completed", "cancelled"]; // 75% завершених

const trips = [];
const now = new Date();

for (let i = 0; i < 5000; i++) {
  const user = USERS[Math.floor(Math.random() * USERS.length)];
  const scooter = SCOOTERS[Math.floor(Math.random() * SCOOTERS.length)];
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  const daysAgo = Math.floor(Math.random() * 180); // останні півроку
  const startDate = new Date(now - daysAgo * 86400000 - Math.random() * 86400000);
  const durationMin = Math.floor(Math.random() * 45) + 2;
  const price = parseFloat((durationMin * 0.15 + 1.0).toFixed(2)); // 1.0 EUR старт + 0.15/хв

  trips.push({
    user_id: user,
    scooter_id: scooter,
    status: status,
    date: startDate,
    duration_min: durationMin,
    price: price,
    start_location: {
      type: "Point",
      coordinates: [14.40 + Math.random() * 0.06, 50.07 + Math.random() * 0.04]
    }
  });
}

db.trips.insertMany(trips);
print(`Вставлено записів: ${db.trips.countDocuments()}`);
