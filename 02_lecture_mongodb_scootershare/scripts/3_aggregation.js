// Частина 3. Довідник моделей + pipeline «топ самокатів за виручкою».
// Потрібні колекції scooters (1_scooters.js) і trips (2_trips.js).
db.scooter_models.drop();
db.scooter_models.insertMany([
  { _id: "Xiaomi Pro 2",   top_speed_kmh: 25, range_km: 45, weight_kg: 14.2 },
  { _id: "Segway Ninebot", top_speed_kmh: 30, range_km: 40, weight_kg: 15.1 },
  { _id: "Ninebot Max",    top_speed_kmh: 30, range_km: 65, weight_kg: 18.7 }
]);

db.trips.aggregate([
  { $match: { status: "completed" } },                                  // 1: лише завершені
  { $group: {                                                           // 2: по самокату
      _id: "$scooter_id",
      total_revenue: { $sum: "$price" },
      total_trips:   { $sum: 1 },
      avg_duration:  { $avg: "$duration_min" }
  } },
  { $sort: { total_revenue: -1 } },                                     // 3: за виручкою
  { $lookup: { from: "scooters", localField: "_id", foreignField: "_id", as: "scooter_info" } },  // 4
  { $unwind: "$scooter_info" },                                         // 5: масив -> об'єкт
  { $lookup: { from: "scooter_models", localField: "scooter_info.model", foreignField: "_id", as: "model_info" } }, // 6
  { $project: {                                                         // 7: підсумок
      scooter_id:    "$_id",
      model:         { $arrayElemAt: ["$model_info._id", 0] },
      top_speed:     { $arrayElemAt: ["$model_info.top_speed_kmh", 0] },
      range_km:      { $arrayElemAt: ["$model_info.range_km", 0] },
      total_revenue: { $round: ["$total_revenue", 2] },
      total_trips:   1,
      avg_duration:  { $round: ["$avg_duration", 1] },
      _id:           0
  } }
]).forEach(d => print(JSON.stringify(d)));
