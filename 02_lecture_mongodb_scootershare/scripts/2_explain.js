// Завдання 2.1–2.2: той самий запит без індексу і з compound-індексом { user_id: 1, date: -1 }.
// Друкуємо лише ключові поля explain(); повний вивід — у mongosh (./demo.sh shell).

function stages(s) {                 // ланцюжок стадій плану: SORT <- COLLSCAN
  const out = [];
  for (; s; s = s.inputStage) out.push(s.stage + (s.indexName ? ` (${s.indexName})` : ""));
  return out.join(" <- ");
}
function show(title) {
  const e = db.trips.find({ user_id: "user_001" }).sort({ date: -1 }).explain("executionStats");
  const x = e.executionStats;
  print(`\n${title}`);
  print(`  план:               ${stages(e.queryPlanner.winningPlan)}`);
  print(`  totalDocsExamined:  ${x.totalDocsExamined}`);
  print(`  totalKeysExamined:  ${x.totalKeysExamined}`);
  print(`  nReturned:          ${x.nReturned}`);
  print(`  executionTimeMillis:${x.executionTimeMillis}`);
}

db.trips.dropIndexes();              // старт без індексів (крім _id)
show("2.1  Без індексу");

db.trips.createIndex({ user_id: 1, date: -1 });
show("2.2  З індексом { user_id: 1, date: -1 }");
