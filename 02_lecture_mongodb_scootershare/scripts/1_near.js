// Завдання 1.2: 3 найближчі вільні самокати біля Můstek (14.4230, 50.0840).
printjson(
  db.scooters.find(
    {
      status: "free",
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [14.4230, 50.0840] },  // довгота, широта
          $maxDistance: 2000  // 2 км
        }
      }
    }
  ).limit(3).toArray()
);

// Для порівняння: ті самі 3 найближчі, але БЕЗ фільтра за статусом — з відстанню в метрах.
print("\nБез фільтра status (відстань, м):");
db.scooters.aggregate([
  { $geoNear: { near: { type: "Point", coordinates: [14.4230, 50.0840] }, distanceField: "dist_m" } },
  { $limit: 5 },
  { $project: { status: 1, battery_pct: 1, dist_m: { $round: ["$dist_m", 0] } } }
]).forEach(d => print(`  ${d._id}  ${d.status.padEnd(4)}  ${String(d.battery_pct).padStart(3)}%  ${d.dist_m} м`));
