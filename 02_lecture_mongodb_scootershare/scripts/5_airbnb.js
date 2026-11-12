// Бонус 1.3: геопошук на sample_airbnb.listingsAndReviews (Atlas Sample Dataset або ./demo.sh load-sample).
const air = db.getSiblingDB("sample_airbnb").listingsAndReviews;
air.createIndex({ "address.location": "2dsphere" });

// Які міста є в датасеті (поле address.market)?
print("Ринки в датасеті: " + air.distinct("address.market").filter(Boolean).sort().join(", "));

// Завдання A (у автора): 5 найближчих доступних оголошень біля Rossio, Лісабон.
print("\nA. Біля Rossio, Лісабон (1 км):");
const a = air.find(
  {
    "address.country": "Portugal",
    "availability.availability_365": { $gt: 0 },
    "address.location": {
      $near: { $geometry: { type: "Point", coordinates: [-9.1393, 38.7139] }, $maxDistance: 1000 }
    }
  },
  { name: 1, "address.street": 1, price: 1, _id: 0 }
).limit(5).toArray();
print("  знайдено: " + a.length);

// Той самий запит біля Praça da Liberdade, Порту — це місто в датасеті є.
print("\nA'. Біля Praça da Liberdade, Порту (1 км):");
air.find(
  {
    "address.country": "Portugal",
    "availability.availability_365": { $gt: 0 },
    "address.location": {
      $near: { $geometry: { type: "Point", coordinates: [-8.6109, 41.1496] }, $maxDistance: 1000 }
    }
  },
  { name: 1, price: 1, "review_scores.review_scores_rating": 1, _id: 0 }
).limit(5).forEach(d => print(`  ${d.price}  ${d.review_scores?.review_scores_rating ?? "-"}  ${d.name}`));

// Завдання B: усі оголошення в колі 500 м від Praça da Liberdade, Порту.
const b = air.countDocuments({
  "address.country": "Portugal",
  "address.location": {
    $geoWithin: { $centerSphere: [[-8.6109, 41.1496], 0.5 / 6378.1] }   // 500 м у радіанах
  }
});
print("\nB. У колі 500 м від центру Порту: " + b);
