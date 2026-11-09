// Кожні 0.3 с читає документ з ЛОКАЛЬНОГО вузла і друкує час, роль вузла та status.
// Запуск: ./lab.sh watch mongo2   (зупинити — Ctrl+C)
const items = db.getSiblingDB("shop").items;
while (true) {
  const doc = items.findOne({ _id: 1 });
  const role = db.hello().isWritablePrimary ? "PRIMARY  " : "SECONDARY";
  print(new Date().toISOString().slice(11, 23), role, "status =", doc ? doc.status : "—");
  sleep(300);
}
