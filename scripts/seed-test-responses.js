"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_DIR = path.resolve(process.env.DATA_DIR || "/data/responses");
const TEST_BATCH = "analytics-demo-v1";
const TOTAL = 50;
let seed = 0x5ca1a202;

function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
}

function integer(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function weighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return String(item.value);
  }
  return String(items.at(-1).value);
}

function sample(values, min, max) {
  const pool = values.map(String);
  const count = Math.min(pool.length, integer(min, Math.min(max, pool.length)));
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [pool[index], pool[next]] = [pool[next], pool[index]];
  }
  return pool.slice(0, count);
}

function maybe(probability) {
  return random() < probability;
}

function dateFor(index) {
  const now = Date.now();
  const daysAgo = Math.round((index / (TOTAL - 1)) * 48 + random() * 3);
  const created = new Date(now - daysAgo * 86400000 - integer(0, 18) * 3600000);
  const updated = new Date(created.getTime() + integer(4, 48) * 60000);
  return { createdAt: created.toISOString(), updatedAt: updated.toISOString() };
}

function makeCompleteAnswers(index) {
  const answers = {};
  answers.a1 = weighted([
    { value: 1, weight: 48 },
    { value: 2, weight: 30 },
    { value: 3, weight: 17 },
    { value: "other", weight: 5 },
  ]);
  if (answers.a1 === "other") answers.a1_other = index % 2 ? "Проектный офис" : "Сервисный отдел";

  answers.a2 = weighted([
    { value: 1, weight: 24 },
    { value: 2, weight: 32 },
    { value: 3, weight: 25 },
    { value: 4, weight: 13 },
    { value: 5, weight: 6 },
  ]);
  answers.a3 = sample(["1", "2", "3", "4", "5"], 1, 3);
  if (maybe(0.12)) {
    answers.a3.push("98");
    answers.a3_other = index % 2 ? "Телеком" : "Энергетика";
  }

  answers.a4 = sample(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], 2, 5);
  for (const role of answers.a4) {
    answers[`a5_${role}`] = weighted([
      { value: 1, weight: 22 },
      { value: 2, weight: 38 },
      { value: 3, weight: 29 },
      { value: 4, weight: 11 },
    ]);
  }

  answers.a6 = sample(["1", "2", "3", "4", "5", "6", "7", "8"], 2, 5);
  answers.a7 = sample(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"], 3, 6);
  if (maybe(0.08)) {
    answers.a7.push("98");
    answers.a7_other = "Условия финансирования";
  }
  answers.a8 = sample(answers.a7, 1, Math.min(3, answers.a7.length));

  answers.b1 = weighted([
    { value: 1, weight: 8 },
    { value: 2, weight: 29 },
    { value: 3, weight: 38 },
    { value: 4, weight: 25 },
  ]);
  if (answers.b1 !== "4") {
    answers.b2 = sample(answers.a4, 1, Math.min(3, answers.a4.length));
    answers.b3 = sample(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"], 1, 4);
  }

  answers.b4 = weighted([
    { value: 1, weight: 5 },
    { value: 2, weight: 23 },
    { value: 3, weight: 37 },
    { value: 4, weight: 35 },
  ]);
  if (answers.b4 !== "4") {
    answers.b5 = sample(answers.a4, 1, Math.min(3, answers.a4.length));
    answers.b6 = sample(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], 1, 4);
  }
  if (answers.b1 !== "4" || answers.b4 !== "4") {
    const trustIdeas = [
      "Больше отраслевых кейсов с измеримым результатом и отзывами заказчиков.",
      "Показывать сравнение с конкурентами, дорожную карту продукта и SLA поддержки.",
      "Чаще проводить пилоты и технические демонстрации для команды клиента.",
      "Усилить публичность экспертов и прозрачнее рассказывать о крупных внедрениях.",
      "Давать клиенту больше подтверждений надёжности: сертификаты, тесты и референсы.",
    ];
    answers.b7 = trustIdeas[index % trustIdeas.length];
  }

  answers.c1 = sample(["1", "2", "3", "4", "5"], 2, 4);
  if (answers.c1.includes("1")) answers.c2 = sample(["1", "2", "3", "4", "5", "6", "9", "10"], 1, 4);
  if (answers.c1.includes("2")) answers.c3 = sample(["1", "2", "6", "7", "9", "10", "11", "12", "13"], 2, 5);
  if (answers.c1.includes("3")) answers.c4 = [index % 3 ? "Код ИБ" : "CNews", "Кибербезопасность и бизнес"];
  if (answers.c1.includes("4")) answers.c5 = [index % 2 ? "Positive Technologies" : "Хабр"];
  if (answers.c1.includes("5")) answers.c6 = [index % 2 ? "Запуск завтра" : "Подлодка"];

  answers.c7 = sample(["1", "2", "3", "4", "5"], 2, 4);
  if (answers.c7.includes("1")) answers.c8 = sample(["1", "2", "3", "4", "5", "10"], 1, 4);
  if (answers.c7.includes("2")) answers.c9 = sample(["1", "2", "7", "9", "10", "11", "12", "13"], 2, 5);
  if (answers.c7.includes("3")) answers.c10 = [index % 2 ? "Код ИБ" : "Инфобезопасность"];
  if (answers.c7.includes("4")) answers.c11 = [index % 2 ? "CNews" : "Технологии бизнеса"];
  if (answers.c7.includes("5")) answers.c12 = [index % 2 ? "ИТ-Бизнес" : "Технофакт"];

  answers.c13 = weighted([
    { value: 1, weight: 72 },
    { value: 2, weight: 18 },
    { value: 3, weight: 10 },
  ]);
  if (answers.c13 === "1") {
    answers.c14 = sample(["1", "2", "3", "4", "5"], 1, 4);
    for (const format of answers.c14) {
      answers[`c15_${format}`] = weighted([
        { value: 1, weight: 17 },
        { value: 2, weight: 51 },
        { value: 3, weight: 27 },
        { value: 99, weight: 5 },
      ]);
    }
  }

  answers.c16 = sample(["1", "2", "3", "4", "5", "6"], 1, 4);
  if (maybe(0.34)) {
    const notes = [
      "Клиентам важно видеть не только характеристики, но и экономический эффект внедрения.",
      "Хорошо работают живые референсы и возможность поговорить с действующим заказчиком.",
      "Нужны короткие материалы для руководителей и отдельные технические разборы для команды.",
      "Решение воспринимается сильнее после пилота и детальной демонстрации поддержки.",
    ];
    answers.c17 = notes[index % notes.length];
  }

  return answers;
}

function keepKeysThrough(answers, stage) {
  const order = ["a", "b", "c"];
  const allowed = new Set(order.slice(0, order.indexOf(stage) + 1));
  for (const key of Object.keys(answers)) {
    if (!allowed.has(key[0])) delete answers[key];
  }
}

async function writeRecord(record) {
  const filePath = path.join(DATA_DIR, `${record.id}.json`);
  try {
    const handle = await fs.open(filePath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, "utf8");
    await handle.close();
    return "created";
  } catch (error) {
    if (error?.code === "EEXIST") return "skipped";
    throw error;
  }
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  let created = 0;
  let skipped = 0;

  for (let index = 1; index <= TOTAL; index += 1) {
    const id = `test-reputation-analytics-${String(index).padStart(3, "0")}`;
    const dates = dateFor(index);
    let status = "completed";
    let answers = makeCompleteAnswers(index);

    if (index >= 45 && index <= 48) {
      status = "in_progress";
      keepKeysThrough(answers, index <= 46 ? "a" : "b");
    }
    if (index >= 49) {
      status = "screened_out";
      answers = { a1: answers.a1, a2: "97" };
    }

    const result = await writeRecord({
      schemaVersion: 1,
      id,
      createdAt: dates.createdAt,
      updatedAt: dates.updatedAt,
      revision: Object.keys(answers).length + integer(4, 12),
      status,
      answers,
      isTest: true,
      testBatch: TEST_BATCH,
    });
    if (result === "created") created += 1;
    else skipped += 1;
  }

  console.log(JSON.stringify({ ok: true, batch: TEST_BATCH, requested: TOTAL, created, skipped }));
}

main().catch((error) => {
  console.error("seed_failed", error);
  process.exit(1);
});
