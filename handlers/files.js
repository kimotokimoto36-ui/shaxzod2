// handlers/files.js
// Admin uchun "Fayl qo'shish" wizard sahnasi va faylni o'chirish logikasi

const { Scenes, Markup } = require('telegraf');
const db = require('../database/db');
const { isAdmin } = require('../utils/helpers');
const { confirmCancelInline, adminMainKeyboard, deleteListKeyboard } = require('../utils/keyboards');

const SCENE_ID = 'add_file_wizard';

// ------------------------------------------------------------------
// Fayl qo'shish wizard sahnasi
// ------------------------------------------------------------------
const addFileWizard = new Scenes.WizardScene(
  SCENE_ID,
  // 1-qadam: fayl nomini so'rash
  async (ctx) => {
    if (!isAdmin(ctx)) return ctx.scene.leave();
    await ctx.reply('📁 Fayl nomini kiriting:');
    return ctx.wizard.next();
  },
  // 2-qadam: nomni qabul qilish, tavsifni so'rash
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply('❌ Iltimos, matn ko\'rinishida fayl nomini kiriting.');
      return;
    }
    ctx.wizard.state.name = ctx.message.text.trim();
    await ctx.reply('📝 Fayl tavsifini kiriting:');
    return ctx.wizard.next();
  },
  // 3-qadam: tavsifni qabul qilish, faylni so'rash
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply('❌ Iltimos, matn ko\'rinishida tavsif kiriting.');
      return;
    }
    ctx.wizard.state.description = ctx.message.text.trim();
    await ctx.reply('📎 Endi Telegram faylini yuboring (document, rasm, video yoki audio):');
    return ctx.wizard.next();
  },
  // 4-qadam: faylni qabul qilish va tasdiqlashni so'rash
  async (ctx) => {
    const msg = ctx.message;
    let fileId = null;
    let fileType = 'document';

    if (msg?.document) {
      fileId = msg.document.file_id;
      fileType = 'document';
    } else if (msg?.photo) {
      fileId = msg.photo[msg.photo.length - 1].file_id;
      fileType = 'photo';
    } else if (msg?.video) {
      fileId = msg.video.file_id;
      fileType = 'video';
    } else if (msg?.audio) {
      fileId = msg.audio.file_id;
      fileType = 'audio';
    }

    if (!fileId) {
      await ctx.reply('❌ Iltimos, to\'g\'ri fayl (document/rasm/video/audio) yuboring.');
      return;
    }

    ctx.wizard.state.fileId = fileId;
    ctx.wizard.state.fileType = fileType;

    await ctx.reply(
      `📋 Tekshiring:\n\n📁 Nomi: ${ctx.wizard.state.name}\n📝 Tavsif: ${ctx.wizard.state.description}\n\nSaqlaymizmi?`,
      confirmCancelInline('addfile')
    );
    return ctx.wizard.next();
  },
  // 5-qadam: tasdiqlash yoki bekor qilishni kutish
  async (ctx) => {
    // Bu qadam faqat action handlerlar orqali boshqariladi (pastda)
    return;
  }
);

addFileWizard.action('addfile_confirm', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const { name, description, fileId, fileType } = ctx.wizard.state;
    const id = db.addFile(name, description, fileId, fileType);
    if (id) {
      await ctx.editMessageText('✅ Fayl muvaffaqiyatli saqlandi va menyuga qo\'shildi.');
    } else {
      await ctx.editMessageText('❌ Faylni saqlashda xatolik yuz berdi.');
    }
  } catch (err) {
    console.error('[files] addfile_confirm xatolik:', err.message);
  } finally {
    await ctx.reply('Admin panel:', adminMainKeyboard());
    return ctx.scene.leave();
  }
});

addFileWizard.action('addfile_cancel', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Bekor qilindi.');
  } catch (err) {
    console.error('[files] addfile_cancel xatolik:', err.message);
  } finally {
    await ctx.reply('Admin panel:', adminMainKeyboard());
    return ctx.scene.leave();
  }
});

// ------------------------------------------------------------------
// Faylni o'chirish (ro'yxatdan tanlab)
// ------------------------------------------------------------------
function registerFileDeleteHandlers(bot) {
  bot.action(/delete_file_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    try {
      await ctx.answerCbQuery();
      const fileId = Number(ctx.match[1]);
      const file = db.getFileById(fileId);
      if (!file) {
        return ctx.editMessageText('❌ Fayl topilmadi.');
      }
      await ctx.editMessageText(
        `🗑 "${file.name}" faylini o'chirishni tasdiqlaysizmi?`,
        confirmCancelInline(`realdeletefile_${fileId}`)
      );
    } catch (err) {
      console.error('[files] delete_file xatolik:', err.message);
    }
  });

  bot.action(/realdeletefile_(\d+)_confirm/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    try {
      await ctx.answerCbQuery();
      const fileId = Number(ctx.match[1]);
      db.deleteFile(fileId);
      await ctx.editMessageText('✅ Fayl bazadan o\'chirildi.');
    } catch (err) {
      console.error('[files] realdeletefile_confirm xatolik:', err.message);
    }
  });

  bot.action(/realdeletefile_(\d+)_cancel/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Bekor qilindi.');
  });
}

module.exports = { addFileWizard, registerFileDeleteHandlers, SCENE_ID };
