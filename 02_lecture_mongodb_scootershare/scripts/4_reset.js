// Повернути sc-003 у початковий стан перед завданням 4.2.
db.scooters.updateOne({ _id: "sc-003" }, { $set: { status: "free" } });
db.trips.deleteMany({ scooter_id: "sc-003", status: "active" });
printjson(db.scooters.findOne({ _id: "sc-003" }, { status: 1 }));
print("Активних поїздок sc-003: " + db.trips.countDocuments({ scooter_id: "sc-003", status: "active" }));
