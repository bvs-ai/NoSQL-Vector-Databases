// Бонус 3.2: агрегації на sample_geospatial.shipwrecks.
const sw = db.getSiblingDB("sample_geospatial").shipwrecks;
print("Документів: " + sw.estimatedDocumentCount());

print("\nA. Аварії за типами (feature_type):");
sw.aggregate([
  { $group: { _id: "$feature_type", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).forEach(d => print(`  ${String(d.count).padStart(6)}  ${d._id}`));

print("\nB. Глибина за типом води (watlev), depth > 0:");
sw.aggregate([
  { $match: { depth: { $gt: 0 }, watlev: { $exists: true, $ne: "" } } },
  { $group: { _id: "$watlev", avg_depth: { $avg: "$depth" }, max_depth: { $max: "$depth" }, count: { $sum: 1 } } },
  { $project: { water_level: "$_id", avg_depth: { $round: ["$avg_depth", 1] }, max_depth: 1, count: 1, _id: 0 } },
  { $sort: { avg_depth: -1 } }
]).forEach(d => print("  " + JSON.stringify(d)));

print("\nC. Балтика: lon 9..30, lat 53..66");
const box = { coordinates: { $geoWithin: { $box: [[9, 53], [30, 66]] } } };
print("  $geoWithin + $box:         " + sw.countDocuments(box));
print("  $match за latdec/londec:   " +
  sw.countDocuments({ londec: { $gte: 9, $lte: 30 }, latdec: { $gte: 53, $lte: 66 } }));

// Де насправді лежать дані: межі координат
sw.aggregate([{ $group: { _id: null,
  lon_min: { $min: "$londec" }, lon_max: { $max: "$londec" },
  lat_min: { $min: "$latdec" }, lat_max: { $max: "$latdec" } } }])
  .forEach(d => print(`  Межі датасету: lon ${d.lon_min}..${d.lon_max}, lat ${d.lat_min}..${d.lat_max}`));

// Дані — карти NOAA (здебільшого води США). Той самий запит для Великих озер:
print("  Великі озера [[-93,41],[-76,49]]: " +
  sw.countDocuments({ coordinates: { $geoWithin: { $box: [[-93, 41], [-76, 49]] } } }));

// Індекс для $box: 2d (площина) — $box працює з координатними парами
sw.createIndex({ coordinates: "2d" });
const e = sw.find(box).explain("executionStats");
let s = e.queryPlanner.winningPlan; const st = [];
for (; s; s = s.inputStage) st.push(s.stage);
print("  План з індексом 2d: " + st.join(" <- "));
