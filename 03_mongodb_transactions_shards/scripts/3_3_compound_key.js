// Частина 3, крок 3: складений ключ { userId: 1, _id: "hashed" }. Запуск: ./demo.sh 3.3
load("/scripts/3_0_show.js")
db = db.getSiblingDB("store")
db.user_events.drop()

sh.enableSharding("store")
db.createCollection("user_events")
sh.shardCollection("store.user_events", { userId: 1, _id: "hashed" })

// Порожня колекція з таким ключем — це ОДИН chunk на одному шарді. Balancer ділить chunk лише
// тоді, коли даних більше за його розмір (128 МБ), а в нас ~9 МБ. Тому ділимо діапазон userId
// навпіл самі й віддаємо верхню половину другому шарду. На великих обсягах це зробив би balancer.
const homeShard = db.getSiblingDB("config").databases.findOne({ _id: "store" }).primary
const otherShard = homeShard === "shard1" ? "shard2" : "shard1"
sh.splitAt("store.user_events", { userId: "user_50", _id: MinKey })
db.adminCommand({ moveRange: "store.user_events", min: { userId: "user_50", _id: MinKey }, toShard: otherShard })
print("userId < user_50 →", homeShard, "| userId >= user_50 →", otherShard)

// Вставити 100 000 подій для 100 користувачів
let bulk3 = db.user_events.initializeUnorderedBulkOp()
for (let i = 0; i < 100000; i++) {
  bulk3.insert({
    userId: "user_" + Math.floor(Math.random() * 100),
    action: "click",
    page: "/page/" + i,
    ts: new Date()
  })
}
bulk3.execute()

showDistribution("user_events")

// Куди mongos відправляє запит: на один шард чи на всі
const route = (query) => {
  const plan = db.user_events.find(query).explain().queryPlanner.winningPlan
  return plan.stage.padEnd(13) + "шарди: " + plan.shards.map(s => s.shardName).sort().join(", ")
}
print('find({ userId: "user_42" }) →', route({ userId: "user_42" }), "  ← є префікс ключа")
print('find({ page: "/page/42" })  →', route({ page: "/page/42" }), "  ← ключа в запиті немає")
