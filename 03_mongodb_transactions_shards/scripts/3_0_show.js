// Частина 3, допоміжний файл: функція showDistribution(). Її завантажують (load) кроки 3.1–3.4.
// Друкує по рядку на шард: скільки документів колекції на ньому лежить і скільки chunks.
// Це коротка заміна db.<колекція>.getShardDistribution(), яку зручно порівнювати очима.
function showDistribution(collName) {
  const ns = "store." + collName
  const config = db.getSiblingDB("config")

  // Документи по шардах
  const docs = {}
  db.getSiblingDB("admin")
    .aggregate([{ $shardedDataDistribution: {} }, { $match: { ns: ns } }])
    .forEach(d => d.shards.forEach(s => { docs[s.shardName] = s.numOwnedDocuments }))
  const total = Object.values(docs).reduce((a, b) => a + b, 0)

  // Chunks по шардах. З MongoDB 5.0 chunks прив'язані не до імені колекції, а до її UUID.
  const uuid = config.collections.findOne({ _id: ns }).uuid

  print(ns)
  config.shards.find().sort({ _id: 1 }).forEach(shard => {
    const n = docs[shard._id] || 0
    const percent = total ? Math.round(100 * n / total) : 0
    const chunks = config.chunks.countDocuments({ uuid: uuid, shard: shard._id })
    print("  " + shard._id,
          "█".repeat(Math.round(percent / 4)).padEnd(25, "·"),
          String(n).padStart(6), "док.", String(percent).padStart(3) + "%",
          "| chunks:", chunks)
  })
}
