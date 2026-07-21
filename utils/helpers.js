// utils/helpers.js
// Bir necha joyda qayta-qayta ishlatiladigan yordamchi funksiyalar

/**
 * ctx yuboruvchisi admin ekanligini tekshiradi
 */
function isAdmin(ctx) {
  const adminId = Number(process.env.ADMIN_ID);
  return ctx.from && Number(ctx.from.id) === adminId;
}

/**
 * Sana va vaqtni chiroyli formatda qaytaradi
 */
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr.includes('Z') ? dateStr : dateStr + 'Z');
    return date.toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * HTML belgilarini xavfsiz shaklga o'tkazadi (parse_mode: HTML bilan ishlatilganda)
 */
function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Ma'lum vaqt kutish (broadcast paytida flood-limitga tushmaslik uchun)
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { isAdmin, formatDate, escapeHtml, sleep };
