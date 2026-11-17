// Частина 3, крок 2: хороший shard key — hashed _id. Запуск: ./demo.sh 3.2
load("/scripts/3_0_show.js")
db = db.getSiblingDB("store")
db.events_good.drop()

sh.enableSharding("store")
db.createCollection("events_good")
sh.shardCollection("store.events_good", { _id: "hashed" })

// Ті самі 10 000 документів
let bulk2 = db.events_good.initializeUnorderedBulkOp()
for (let i = 0; i < 10000; i++) {
  bulk2.insert({
    eventType: "page_view",
    userId: "user_" + Math.floor(Math.random() * 1000),
    createdAt: new Date(),
    page: "/product/" + i
  })
}
bulk2.execute({ w: "majority" })

// Порівнюємо розподіл
showDistribution("events_good")
