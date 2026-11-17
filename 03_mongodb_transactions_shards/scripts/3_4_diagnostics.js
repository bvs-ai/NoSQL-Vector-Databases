// Частина 3, крок 4: швидка діагностика кластера. Запуск: ./demo.sh 3.4
// Повний звіт — у mongosh: ./demo.sh shell mongos → sh.status()  (кілька екранів тексту).
load("/scripts/3_0_show.js")
db = db.getSiblingDB("store")
const config = db.getSiblingDB("config")

// Які шарди є в кластері
db.adminCommand({ listShards: 1 }).shards.forEach(s => print("Шард", s._id, "→", s.host))

// Перевірити балансувальник
print("Balancer увімкнено:", sh.getBalancerState())

// Кількість chunks по шардах — запит зі сценарію заняття: фільтр за полем ns
const byNs = config.chunks.aggregate([
  { $match: { ns: "store.events_good" } },
  { $group: { _id: "$shard", count: { $sum: 1 } } }
]).toArray()
print("chunks events_good, фільтр за ns:  ", JSON.stringify(byNs), " ← порожньо: з MongoDB 5.0 поля ns немає")

// Правильно — за UUID колекції з config.collections
const good = config.collections.findOne({ _id: "store.events_good" })
if (good) {
  const byUuid = config.chunks.aggregate([
    { $match: { uuid: good.uuid } },
    { $group: { _id: "$shard", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray()
  print("chunks events_good, фільтр за uuid:", JSON.stringify(byUuid))
}

// Усі три колекції поруч — підсумок частини 3
print()
for (const coll of ["events_bad", "events_good", "user_events"]) {
  if (config.collections.findOne({ _id: "store." + coll })) showDistribution(coll)
  else print("store." + coll, "— ще не створено (запустіть кроки 3.1–3.3)")
}
