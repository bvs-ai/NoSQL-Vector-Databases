// Частина 1. Датасет: 12 самокатів у Празі + геоіндекс 2dsphere (завдання 1.1).
// Повторний запуск безпечний: колекція перестворюється.
db.scooters.drop();

db.scooters.insertMany([
  { _id: "sc-001", model: "Xiaomi Pro 2",   battery_pct: 87, status: "free", location: { type: "Point", coordinates: [14.4208, 50.0880] } }, // Вацлавська площа
  { _id: "sc-002", model: "Segway Ninebot", battery_pct: 43, status: "busy", location: { type: "Point", coordinates: [14.4185, 50.0865] } }, // Mustek
  { _id: "sc-003", model: "Xiaomi Pro 2",   battery_pct: 95, status: "free", location: { type: "Point", coordinates: [14.4150, 50.0900] } }, // Nove Mesto
  { _id: "sc-004", model: "Ninebot Max",    battery_pct: 61, status: "free", location: { type: "Point", coordinates: [14.4231, 50.0875] } }, // Jindrisska
  { _id: "sc-005", model: "Segway Ninebot", battery_pct: 12, status: "busy", location: { type: "Point", coordinates: [14.4100, 50.0870] } }, // Narodni trida
  { _id: "sc-006", model: "Ninebot Max",    battery_pct: 78, status: "free", location: { type: "Point", coordinates: [14.4260, 50.0855] } }, // Namesti Miru
  { _id: "sc-007", model: "Xiaomi Pro 2",   battery_pct: 55, status: "free", location: { type: "Point", coordinates: [14.4190, 50.0920] } }, // Vinohradska
  { _id: "sc-008", model: "Ninebot Max",    battery_pct: 90, status: "busy", location: { type: "Point", coordinates: [14.4300, 50.0840] } }, // Vinohrady
  { _id: "sc-009", model: "Segway Ninebot", battery_pct: 33, status: "free", location: { type: "Point", coordinates: [14.4130, 50.0850] } }, // Karlovo namesti
  { _id: "sc-010", model: "Xiaomi Pro 2",   battery_pct: 70, status: "free", location: { type: "Point", coordinates: [14.4170, 50.0910] } }, // Stepanska
  { _id: "sc-011", model: "Ninebot Max",    battery_pct: 88, status: "busy", location: { type: "Point", coordinates: [14.4220, 50.0895] } }, // Blanik
  { _id: "sc-012", model: "Segway Ninebot", battery_pct: 47, status: "free", location: { type: "Point", coordinates: [14.4080, 50.0860] } }  // Lazarska
]);
print("Самокатів у колекції: " + db.scooters.countDocuments());

// Завдання 1.1: геоіндекс
db.scooters.createIndex({ location: "2dsphere" });
printjson(db.scooters.getIndexes().map(i => i.key));
