// Частина 3, крок 1: поганий shard key — час створення (монотонно зростає). Запуск: ./demo.sh 3.1
load("/scripts/3_0_show.js")
db = db.getSiblingDB("store")
db.events_bad.drop()

// Створити колекцію з timestamp як shard key (антипатерн!)
sh.enableSharding("store")
db.createCollection("events_bad")
sh.shardCollection("store.events_bad", { createdAt: 1 })

// Вставити 10 000 документів з поточним часом
let bulk = db.events_bad.initializeUnorderedBulkOp()
for (let i = 0; i < 10000; i++) {
  bulk.insert({
    eventType: "page_view",
    userId: "user_" + Math.floor(Math.random() * 1000),
    createdAt: new Date(),   // час лише зростає — кожен новий документ іде в "останній" chunk
    page: "/product/" + i
  })
}
bulk.execute({ w: "majority" })

// Дивимося на розподіл (у mongosh те саме, але довше: db.events_bad.getShardDistribution())
showDistribution("events_bad")
