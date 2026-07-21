// handlers/user.js
// Oddiy foydalanuvchi uchun /start, menyu va fayl ko'rish logikasi

const db = require('../database/db');
const { isSubscribed } = require('../middlewares/subscribe');
const { subscribeKeyboard, userMainKeyboard } = require('../utils/keyboards');
const { isAdmin, formatDate } = require('../utils/helpers');

/**
 * Foydalanuvchiga asosiy menyuni (fayllar + testlar ro'yxati) yuboradi.
 * Har safar chaqirilganda bazadan yangi ro'yxat olinadi - shu orqali
 * admin yangi ma'lumot qo'shganda menyu avtomatik yangilanadi.
 */
async function showMainMenu(ctx) {
  try {
    const files = db.getFiles();
    const tests = db.getTests();
    await ctx.reply(
      '📚 Quyidagi menyudan kerakli bo\'limni tanlang:',
      userMainKeyboard(files, tests)
    );
  } catch (err) {
    console.error('[user] showMainMenu xatolik:', err.message);
    await ctx.reply('❌ Xatolik yuz berdi. Keyinroq urinib ko\'ring.');
  }
}

function registerUserHandlers(bot) {
  // /start buyrug'i
  bot.start(async (ctx) => {
    try {
      const isNew = db.upsertUser(ctx.from);

      // Yangi foydalanuvchi haqida adminga xabar
      if (isNew) {
        const adminId = process.env.ADMIN_ID;
        const text =
          `🆕 Yangi foydalanuvchi\n` +
          `👤 Ism: ${ctx.from.first_name || '-'} ${ctx.from.last_name || ''}\n` +
          `📛 Username: ${ctx.from.username ? '@' + ctx.from.username : '-'}\n` +
          `🆔 ID: ${ctx.from.id}\n` +
          `🌐 Til: ${ctx.from.language_code || '-'}\n` +
          `📅 Sana: ${formatDate(new Date().toISOString())}`;
        ctx.telegram.sendMessage(adminId, text).catch(() => {});
      }

      if (isAdmin(ctx)) {
        return ctx.reply('👋 Xush kelibsiz, Admin!');
      }

      const subscribed = await isSubscribed(ctx);
      if (!subscribed) {
        return ctx.reply(
          '🔒 Siz kanalimizga obuna bo\'lmasdan botdan foydalana olmaysiz.',
          subscribeKeyboard(process.env.CHANNEL_USERNAME)
        );
      }

      await ctx.reply('👋 Xush kelibsiz!');
      await showMainMenu(ctx);
    } catch (err) {
      console.error('[user] /start xatolik:', err.message);
      await ctx.reply('❌ Xatolik yuz berdi. Qaytadan /start bosing.');
    }
  });

  // Obunani tasdiqlash tugmasi
  bot.action('check_subscription', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const subscribed = await isSubscribed(ctx);
      if (subscribed) {
        await ctx.editMessageText('🎉 Tabriklaymiz! Endi botdan foydalanishingiz mumkin.');
        await showMainMenu(ctx);
      } else {
        await ctx.answerCbQuery('❌ Siz hali kanalga obuna bo\'lmagansiz.', { show_alert: true });
      }
    } catch (err) {
      console.error('[user] check_subscription xatolik:', err.message);
    }
  });

  // Faylni ko'rish
  bot.action(/view_file_(\d+)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const fileId = Number(ctx.match[1]);
      const file = db.getFileById(fileId);
      if (!file) {
        return ctx.answerCbQuery('❌ Fayl topilmadi.', { show_alert: true });
      }
      const caption = `📁 <b>${file.name}</b>\n\n${file.description || ''}`;
      await ctx.replyWithDocument(file.telegram_file_id, {
        caption,
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('[user] view_file xatolik:', err.message);
      await ctx.reply('❌ Faylni yuborishda xatolik yuz berdi.');
    }
  });

  bot.action('noop', async (ctx) => {
    await ctx.answerCbQuery();
  });
}

module.exports = { registerUserHandlers, showMainMenu };
