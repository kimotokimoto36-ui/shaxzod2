// middlewares/subscribe.js
// Foydalanuvchining kanalga obuna bo'lganligini tekshiruvchi middleware/funksiya

/**
 * Foydalanuvchi CHANNEL_USERNAME kanaliga obuna bo'lganmi - tekshiradi
 * @returns {Promise<boolean>}
 */
async function isSubscribed(ctx) {
  const channelUsername = process.env.CHANNEL_USERNAME;
  if (!channelUsername) return true; // agar sozlanmagan bo'lsa, tekshirmaymiz

  try {
    const member = await ctx.telegram.getChatMember(channelUsername, ctx.from.id);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (err) {
    console.error('[subscribe] tekshiruvda xatolik:', err.message);
    // Bot kanalda admin bo'lmasa yoki xatolik yuz bersa, xavfsizlik uchun false qaytaramiz
    return false;
  }
}

/**
 * Telegraf middleware sifatida ishlatish uchun - admin uchun tekshiruvni chetlab o'tadi
 */
function subscribeMiddleware() {
  return async (ctx, next) => {
    const adminId = Number(process.env.ADMIN_ID);
    if (ctx.from && Number(ctx.from.id) === adminId) {
      return next();
    }

    const subscribed = await isSubscribed(ctx);
    if (!subscribed) {
      const { subscribeKeyboard } = require('../utils/keyboards');
      return ctx.reply(
        '🔒 Siz kanalimizga obuna bo\'lmasdan botdan foydalana olmaysiz.',
        subscribeKeyboard(process.env.CHANNEL_USERNAME)
      );
    }
    return next();
  };
}

module.exports = { isSubscribed, subscribeMiddleware };
