// database/db.js
// SQLite bazasi bilan ishlash uchun barcha funksiyalar shu yerda joylashgan.
// better-sqlite3 sinxron ishlaydi, shuning uchun kod sodda va tezkor bo'ladi.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// storage papkasi mavjudligiga ishonch hosil qilamiz
const storageDir = path.join(__dirname, '..', 'storage');
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

const dbPath = path.join(storageDir, 'database.db');
const db = new Database(dbPath);

// Ma'lumotlar bazasi ishlashini tezlashtirish uchun sozlamalar
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ------------------------------------------------------------------
// Jadvallarni yaratish (agar mavjud bo'lmasa)
// ------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id   INTEGER PRIMARY KEY,
    username      TEXT,
    first_name    TEXT,
    last_name     TEXT,
    language_code TEXT,
    joined_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS files (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    description     TEXT,
    telegram_file_id TEXT NOT NULL,
    file_type       TEXT NOT NULL DEFAULT 'document',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id        INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question       TEXT NOT NULL,
    options        TEXT NOT NULL,   -- JSON array shaklida saqlanadi
    correct_answer INTEGER NOT NULL -- to'g'ri variant indeksi (0 dan boshlanadi)
  );
`);

// ------------------------------------------------------------------
// USERS
// ------------------------------------------------------------------

/**
 * Foydalanuvchini bazaga qo'shadi (agar mavjud bo'lmasa) yoki yangilaydi.
 * @returns {boolean} true - agar bu yangi foydalanuvchi bo'lsa
 */
function upsertUser(user) {
  try {
    const existing = db
      .prepare('SELECT telegram_id FROM users WHERE telegram_id = ?')
      .get(user.id);

    if (existing) {
      db.prepare(
        `UPDATE users SET username = ?, first_name = ?, last_name = ?, language_code = ?
         WHERE telegram_id = ?`
      ).run(
        user.username || null,
        user.first_name || null,
        user.last_name || null,
        user.language_code || null,
        user.id
      );
      return false;
    }

    db.prepare(
      `INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      user.id,
      user.username || null,
      user.first_name || null,
      user.last_name || null,
      user.language_code || null
    );
    return true;
  } catch (err) {
    console.error('[db] upsertUser xatolik:', err.message);
    return false;
  }
}

function getAllUserIds() {
  try {
    return db.prepare('SELECT telegram_id FROM users').all().map((r) => r.telegram_id);
  } catch (err) {
    console.error('[db] getAllUserIds xatolik:', err.message);
    return [];
  }
}

function getUserStats() {
  try {
    const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    const today = db
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE date(joined_at) = date('now')`)
      .get().c;
    const last7 = db
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE joined_at >= datetime('now', '-7 days')`)
      .get().c;
    const last30 = db
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE joined_at >= datetime('now', '-30 days')`)
      .get().c;
    return { total, today, last7, last30 };
  } catch (err) {
    console.error('[db] getUserStats xatolik:', err.message);
    return { total: 0, today: 0, last7: 0, last30: 0 };
  }
}

// ------------------------------------------------------------------
// FILES
// ------------------------------------------------------------------

function addFile(name, description, telegramFileId, fileType = 'document') {
  try {
    const info = db
      .prepare(
        `INSERT INTO files (name, description, telegram_file_id, file_type)
         VALUES (?, ?, ?, ?)`
      )
      .run(name, description, telegramFileId, fileType);
    return info.lastInsertRowid;
  } catch (err) {
    console.error('[db] addFile xatolik:', err.message);
    return null;
  }
}

function getFiles() {
  try {
    return db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();
  } catch (err) {
    console.error('[db] getFiles xatolik:', err.message);
    return [];
  }
}

function getFileById(id) {
  try {
    return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
  } catch (err) {
    console.error('[db] getFileById xatolik:', err.message);
    return null;
  }
}

function deleteFile(id) {
  try {
    db.prepare('DELETE FROM files WHERE id = ?').run(id);
    return true;
  } catch (err) {
    console.error('[db] deleteFile xatolik:', err.message);
    return false;
  }
}

// ------------------------------------------------------------------
// TESTS & QUESTIONS
// ------------------------------------------------------------------

/**
 * Yangi test va uning savollarini bazaga saqlaydi (bitta tranzaksiyada).
 * @param {string} title
 * @param {Array<{question:string, options:string[], correct_answer:number}>} questions
 */
function addTest(title, questions) {
  const insertTest = db.prepare('INSERT INTO tests (title) VALUES (?)');
  const insertQuestion = db.prepare(
    `INSERT INTO questions (test_id, question, options, correct_answer)
     VALUES (?, ?, ?, ?)`
  );

  const transaction = db.transaction((title, questions) => {
    const testInfo = insertTest.run(title);
    const testId = testInfo.lastInsertRowid;
    for (const q of questions) {
      insertQuestion.run(testId, q.question, JSON.stringify(q.options), q.correct_answer);
    }
    return testId;
  });

  try {
    return transaction(title, questions);
  } catch (err) {
    console.error('[db] addTest xatolik:', err.message);
    return null;
  }
}

function getTests() {
  try {
    return db.prepare('SELECT * FROM tests ORDER BY created_at DESC').all();
  } catch (err) {
    console.error('[db] getTests xatolik:', err.message);
    return [];
  }
}

function getTestById(id) {
  try {
    const test = db.prepare('SELECT * FROM tests WHERE id = ?').get(id);
    if (!test) return null;
    const questions = db
      .prepare('SELECT * FROM questions WHERE test_id = ? ORDER BY id ASC')
      .all(id)
      .map((q) => ({ ...q, options: JSON.parse(q.options) }));
    return { ...test, questions };
  } catch (err) {
    console.error('[db] getTestById xatolik:', err.message);
    return null;
  }
}

function deleteTest(id) {
  try {
    db.prepare('DELETE FROM tests WHERE id = ?').run(id);
    return true;
  } catch (err) {
    console.error('[db] deleteTest xatolik:', err.message);
    return false;
  }
}

module.exports = {
  db,
  upsertUser,
  getAllUserIds,
  getUserStats,
  addFile,
  getFiles,
  getFileById,
  deleteFile,
  addTest,
  getTests,
  getTestById,
  deleteTest,
};
