// utils/keyboards.js
// Botning barcha klaviaturalari (reply va inline) shu yerda yig'ilgan

const { Markup } = require('telegraf');

// ------------------------------------------------------------------
// Majburiy obuna klaviaturasi
// ------------------------------------------------------------------
function subscribeKeyboard(channelUsername) {
  const channelLink = `https://t.me/${channelUsername.replace('@', '')}`;
  return Markup.inlineKeyboard([
    [Markup.button.url('📢 Kanalga o\'tish', channelLink)],
    [Markup.button.callback('✅ Tasdiqlash', 'check_subscription')],
  ]);
}

// ------------------------------------------------------------------
// Foydalanuvchi asosiy menyusi (fayllar + testlar ro'yxati bilan dinamik)
// ------------------------------------------------------------------
function userMainKeyboard(files, tests) {
  const buttons = [];
  for (const f of files) {
    buttons.push([Markup.button.callback(`📁 ${f.name}`, `view_file_${f.id}`)]);
  }
  for (const t of tests) {
    buttons.push([Markup.button.callback(`📝 ${t.title}`, `view_test_${t.id}`)]);
  }
  if (buttons.length === 0) {
    buttons.push([Markup.button.callback('Hozircha ma\'lumot yo\'q', 'noop')]);
  }
  return Markup.inlineKeyboard(buttons);
}

// ------------------------------------------------------------------
// Admin panel klaviaturalari
// ------------------------------------------------------------------
function adminMainKeyboard() {
  return Markup.keyboard([
    ['➕ Ma\'lumot qo\'shish', '🗑 Ma\'lumot o\'chirish'],
    ['📊 Statistika'],
    ['⬅️ Foydalanuvchi menyusiga qaytish'],
  ]).resize();
}

function addDataKeyboard() {
  return Markup.keyboard([
    ['📁 Fayl qo\'shish', '📝 Test qo\'shish'],
    ['📨 Xabar yuborish'],
    ['⬅️ Admin panelga qaytish'],
  ]).resize();
}

function broadcastTypeKeyboard() {
  return Markup.keyboard([
    ['👤 Foydalanuvchiga', '🌍 Barchaga'],
    ['⬅️ Bekor qilish'],
  ]).resize();
}

function confirmCancelInline(prefix) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Tasdiqlash', `${prefix}_confirm`),
      Markup.button.callback('❌ Bekor qilish', `${prefix}_cancel`),
    ],
  ]);
}

function testContinueKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('➕ Davom ettirish', 'test_continue'),
      Markup.button.callback('✅ Tugatish', 'test_finish'),
    ],
    [Markup.button.callback('❌ Bekor qilish', 'test_cancel')],
  ]);
}

/**
 * O'chirish uchun ro'yxat klaviaturasi
 * @param {Array} items - {id, name/title} massivi
 * @param {'file'|'test'} type
 */
function deleteListKeyboard(items, type) {
  const buttons = items.map((item) => [
    Markup.button.callback(`🗑 ${item.name || item.title}`, `delete_${type}_${item.id}`),
  ]);
  buttons.push([Markup.button.callback('⬅️ Orqaga', 'delete_back')]);
  return Markup.inlineKeyboard(buttons);
}

/**
 * Test savoli uchun variantlar klaviaturasi (test yechish paytida)
 */
function testOptionsKeyboard(options, questionIndex) {
  const buttons = options.map((opt, idx) => [
    Markup.button.callback(opt, `answer_${questionIndex}_${idx}`),
  ]);
  return Markup.inlineKeyboard(buttons);
}

function removeKeyboard() {
  return Markup.removeKeyboard();
}

module.exports = {
  subscribeKeyboard,
  userMainKeyboard,
  adminMainKeyboard,
  addDataKeyboard,
  broadcastTypeKeyboard,
  confirmCancelInline,
  testContinueKeyboard,
  deleteListKeyboard,
  testOptionsKeyboard,
  removeKeyboard,
};
