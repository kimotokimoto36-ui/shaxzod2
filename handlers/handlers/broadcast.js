// handlers/broadcast.js
// Admin uchun xabar yuborish: bitta foydalanuvchiga yoki barchaga (broadcast)

const { Scenes } = require('telegraf');
const db = require('../database/db');
const { isAdmin, sleep } = require('../utils/helpers');
const { confirmCancelInline, addDataKeyboard } = require('../utils/keyboards');

const TO_USER_SCENE_ID = 'broadcast_user_wizard';
const TO_ALL_SCENE_ID = 'broadcast_all_wizard';

// ------------------------------------------------------------------
// Bitta foydalanuvchiga xabar yuborish
// ------------------------------------------------------------------
const broadcastUserWizard = new Scenes.WizardScene(
  TO_USER_SCENE_ID,
  async (ctx) => {
    if (!isAdmin(ctx)) return ctx.scene.leave();
    await ctx.reply('🆔 Foydalanuvchining Telegram ID raqamini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const id = Number(ctx.message?.text?.trim());
    if (!id) {
      await ctx.reply('❌ Iltimos, to\'g\'ri Telegram ID kiriting (faqat raqam).');
      return;
    }
    ctx.wizard.state.targetId = id;
    await ctx.reply('✉️ Yuboriladigan xabar matnini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) {
      await ctx.reply('❌ Iltimos, matn ko\'rinishida xabar kiriting.');
      return;
    }
    ctx.wizard.state.message = ctx.message.text;
    await ctx.reply(
      `📋 Tekshiring:\n\n🆔 ID: ${ctx.wizard.state.targetId}\n✉️ Xabar:\n${ctx.wizard.state.message}\n\nYuborilsinmi?`,
      confirmCancelInline('senduser')
    );
    return ctx.wizard.next();
  },
  async () => {
    // Tasdiqlash/bekor qilish action orqali boshqariladi
  }
);

broadcastUserWizard.action('senduser_confirm', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const { targetId, message } = ctx.wizard.state;
    try {
      await ctx.telegram.sendMessage(targetId, message);
      await ctx.editMessageText('✅ Xabar muvaffaqiyatli yuborildi.');
    } catch (err) {
      await ctx.editMessageText(
        `❌ Xabarni yuborib bo'lmadi. Sabab: foydalanuvchi botni bloklagan yoki ID noto'g'ri.`
      );
    }
  } catch (err) {
    console.error('[broadcast] senduser_confirm xatolik:', err.message);
  } finally {
    await ctx.reply('Ma\'lumot qo\'shish:', addDataKeyboard());
    return ctx.scene.leave();
  }
});

broadcastUserWizard.action('senduser_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Bekor qilindi.');
  await ctx.reply('Ma\'lumot qo\'shish:', addDataKeyboard());
  return ctx.scene.leave();
});

// ------------------------------------------------------------------
// Barcha foydalanuvchilarga xabar yuborish (broadcast)
// ------------------------------------------------------------------
const broadcastAllWizard = new Scenes.WizardScene(
  TO_ALL_SCENE_ID,
  async (ctx) => {
    if (!isAdmin(ctx)) return ctx.scene.leave();
    await ctx.reply('✉️ Barchaga yuboriladigan xabar matnini kiriting:');
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message?.text) {
      await ctx.reply('❌ Iltimos, matn ko\'rinishida xabar kiriting.');
      return;
    }
    ctx.wizard.state.message = ctx.message.text;
    await ctx.reply(
      `📋 Tekshiring:\n\n✉️ Xabar:\n${ctx.wizard.state.message}\n\nBarcha foydalanuvchilarga yuborilsinmi?`,
      confirmCancelInline('sendall')
    );
    return ctx.wizard.next();
  },
  async () => {
    // Tasdiqlash/bekor qilish action orqali boshqariladi
  }
);

broadcastAllWizard.action('sendall_confirm', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageText('⏳ Xabar yuborilmoqda, biroz kuting...');

    const message = ctx.wizard.state.message;
    const userIds = db.getAllUserIds();
    let success = 0;
    let failed = 0;

    for (const id of userIds) {
      try {
        await ctx.telegram.sendMessage(id, message);
        success++;
      } catch (err) {
        // Bot bloklangan yoki boshqa xatolik - hisobotga qo'shib, davom etamiz
        failed++;
      }
      // Telegram flood-limitiga tushmaslik uchun kichik pauza
      await sleep(50);
    }

    await ctx.reply(
      `📊 Broadcast hisobot:\n\n✅ Yuborildi: ${success}\n❌ Yuborilmadi: ${failed}`
    );
  } catch (err) {
    console.error('[broadcast] sendall_confirm xatolik:', err.message);
    await ctx.reply('❌ Broadcast jarayonida xatolik yuz berdi.');
  } finally {
    await ctx.reply('Ma\'lumot qo\'shish:', addDataKeyboard());
    return ctx.scene.leave();
  }
});

broadcastAllWizard.action('sendall_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('❌ Bekor qilindi.');
  await ctx.reply('Ma\'lumot qo\'shish:', addDataKeyboard());
  return ctx.scene.leave();
});

module.exports = {
  broadcastUserWizard,
  broadcastAllWizard,
  TO_USER_SCENE_ID,
  TO_ALL_SCENE_ID,
};
