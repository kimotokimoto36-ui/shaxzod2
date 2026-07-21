// handlers/tests.js
// 1) Admin uchun "Test qo'shish" wizard sahnasi (cheksiz savol qo'shish imkoniyati bilan)
// 2) Testni o'chirish logikasi
// 3) Foydalanuvchi uchun testni yechish (take_test) sahnasi

const { Scenes } = require('telegraf');
const db = require('../database/db');
const { isAdmin } = require('../utils/helpers');
const {
  confirmCancelInline,
  adminMainKeyboard,
  testContinueKeyboard,
  testOptionsKeyboard,
} = require('../utils/keyboards');

const ADD_TEST_SCENE_ID = 'add_test_wizard';
const TAKE_TEST_SCENE_ID = 'take_test_wizard';

// ------------------------------------------------------------------
// ADMIN: Test qo'shish wizard sahnasi
// ------------------------------------------------------------------
const addTestWizard = new Scenes.WizardScene(
  ADD_TEST_SCENE_ID,
  // 0-qadam: test nomini so'rash
  async (ctx) => {
    if (!isAdmin(ctx)) return ctx.scene.leave();
    ctx.wizard.state.questions = [];
    await ctx.reply('📝 Test nomini kiriting:');
    return ctx.wizard.next();
  },
  // 1-qadam: nomni qabul qilish, 1-savolni so'rash
  async (ctx) => {
    if (!ctx.message?.text) {
      await ctx.reply('❌ Iltimos, matn ko\'rinishida test nomini kiriting.');
      return;
    }
    ctx.wizard.state.title = ctx.message.text.trim();
    await ctx.reply('❓ Savolni kiriting:');
    return ctx.wizard.next();
  },
  // 2-qadam: savolni qabul qilish, variantlarni so'rash
  async (ctx) => {
    if (!ctx.message?.text) {
      await ctx.reply('❌ Iltimos, matn ko\'rinishida savolni kiriting.');
      return;
    }
    ctx.wizard.state.currentQuestion = ctx.message.text.trim();
    await ctx.reply(
      '🔤 Variantlarni kiriting. Har bir variantni alohida qatorga yozing.\n\nMisol:\nBirinchi variant\nIkkinchi variant\nUchinchi variant'
    );
    return ctx.wizard.next();
  },
  // 3-qadam: variantlarni qabul qilish, to'g'ri javobni so'rash
  async (ctx) => {
    if (!ctx.message?.text) {
      await ctx.reply('❌ Iltimos, variantlarni matn ko\'rinishida kiriting.');
      return;
    }
    const options = ctx.message.text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (options.length < 2) {
      await ctx.reply('❌ Kamida 2 ta variant kiriting (har birini yangi qatorda).');
      return;
    }

    ctx.wizard.state.currentOptions = options;
    const numbered = options.map((o, i) => `${i + 1}. ${o}`).join('\n');
    await ctx.reply(`✅ To'g'ri javob raqamini kiriting:\n\n${numbered}`);
    return ctx.wizard.next();
  },
  // 4-qadam: to'g'ri javobni qabul qilish, savolni saqlash va davom/tugatish so'rash
  async (ctx) => {
    const text = ctx.message?.text?.trim();
    const num = Number(text);
    const options = ctx.wizard.state.currentOptions;

    if (!num || num < 1 || num > options.length) {
      await ctx.reply(`❌ 1 dan ${options.length} gacha bo'lgan raqamni kiriting.`);
      return;
    }

    ctx.wizard.state.questions.push({
      question: ctx.wizard.state.currentQuestion,
      options,
      correct_answer: num - 1,
    });

    await ctx.reply(
      `✅ Savol qo'shildi (jami: ${ctx.wizard.state.questions.length} ta).\n\nYana savol qo'shasizmi?`,
      testContinueKeyboard()
    );
    return ctx.wizard.next();
  },
  // 5-qadam: davom ettirish / tugatish / bekor qilish tugmalarini kutish
  async () => {
    // Bu qadam faqat action handlerlar orqali boshqariladi (pastda)
  }
);

addTestWizard.action('test_continue', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.reply('❓ Keyingi savolni kiriting:');
    ctx.wizard.selectStep(2); // "savolni qabul qilish" qadamiga qaytamiz
  } catch (err) {
    console.error('[tests] test_continue xatolik:', err.message);
  }
});

addTestWizard.action('test_finish', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    const { title, questions } = ctx.wizard.state;
    const testId = db.addTest(title, questions);
    if (testId) {
      await ctx.reply(
        `✅ Test muvaffaqiyatli saqlandi!\n📝 Nomi: ${title}\n❓ Savollar soni: ${questions.length}`
      );
    } else {
      await ctx.reply('❌ Testni saqlashda xatolik yuz berdi.');
    }
  } catch (err) {
    console.error('[tests] test_finish xatolik:', err.message);
  } finally {
    await ctx.reply('Admin panel:', adminMainKeyboard());
    return ctx.scene.leave();
  }
});

addTestWizard.action('test_cancel', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.reply('❌ Test qo\'shish bekor qilindi.');
  } catch (err) {
    console.error('[tests] test_cancel xatolik:', err.message);
  } finally {
    await ctx.reply('Admin panel:', adminMainKeyboard());
    return ctx.scene.leave();
  }
});

// ------------------------------------------------------------------
// ADMIN: Testni o'chirish
// ------------------------------------------------------------------
function registerTestDeleteHandlers(bot) {
  bot.action(/delete_test_(\d+)/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    try {
      await ctx.answerCbQuery();
      const testId = Number(ctx.match[1]);
      const test = db.getTestById(testId);
      if (!test) {
        return ctx.editMessageText('❌ Test topilmadi.');
      }
      await ctx.editMessageText(
        `🗑 "${test.title}" testini o'chirishni tasdiqlaysizmi?`,
        confirmCancelInline(`realdeletetest_${testId}`)
      );
    } catch (err) {
      console.error('[tests] delete_test xatolik:', err.message);
    }
  });

  bot.action(/realdeletetest_(\d+)_confirm/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    try {
      await ctx.answerCbQuery();
      const testId = Number(ctx.match[1]);
      db.deleteTest(testId);
      await ctx.editMessageText('✅ Test bazadan o\'chirildi.');
    } catch (err) {
      console.error('[tests] realdeletetest_confirm xatolik:', err.message);
    }
  });

  bot.action(/realdeletetest_(\d+)_cancel/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    await ctx.editMessageText('❌ Bekor qilindi.');
  });
}

// ------------------------------------------------------------------
// FOYDALANUVCHI: Testni yechish sahnasi
// ------------------------------------------------------------------
async function sendQuestion(ctx) {
  const { test, index } = ctx.wizard.state;
  const q = test.questions[index];
  await ctx.reply(
    `❓ ${index + 1}/${test.questions.length}-savol:\n\n${q.question}`,
    testOptionsKeyboard(q.options, index)
  );
}

const takeTestWizard = new Scenes.WizardScene(
  TAKE_TEST_SCENE_ID,
  async (ctx) => {
    const testId = ctx.scene.state?.testId;
    const test = db.getTestById(testId);
    if (!test || !test.questions.length) {
      await ctx.reply('❌ Test topilmadi yoki savollar mavjud emas.');
      return ctx.scene.leave();
    }
    ctx.wizard.state.test = test;
    ctx.wizard.state.index = 0;
    ctx.wizard.state.correct = 0;
    ctx.wizard.state.wrong = 0;
    await sendQuestion(ctx);
    // Sahnada qolamiz - keyingi harakatlar action handlerlar orqali boshqariladi
  }
);

takeTestWizard.action(/answer_(\d+)_(\d+)/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const qIndex = Number(ctx.match[1]);
    const chosen = Number(ctx.match[2]);
    const state = ctx.wizard.state;

    if (!state.test || qIndex !== state.index) {
      return; // eskirgan tugma bosilgan
    }

    const q = state.test.questions[qIndex];
    const isCorrect = chosen === q.correct_answer;
    if (isCorrect) state.correct++;
    else state.wrong++;

    await ctx.editMessageReplyMarkup(undefined).catch(() => {});
    await ctx.reply(
      isCorrect ? '✅ To\'g\'ri javob!' : `❌ Noto'g'ri. To'g'ri javob: ${q.options[q.correct_answer]}`
    );

    state.index++;
    if (state.index < state.test.questions.length) {
      await sendQuestion(ctx);
    } else {
      const total = state.correct + state.wrong;
      const percent = total ? Math.round((state.correct / total) * 100) : 0;
      await ctx.reply(
        `🏁 Test yakunlandi!\n\n✅ To'g'ri javoblar: ${state.correct}\n❌ Noto'g'ri javoblar: ${state.wrong}\n📊 Natija: ${percent}%`
      );
      return ctx.scene.leave();
    }
  } catch (err) {
    console.error('[tests] answer xatolik:', err.message);
  }
});

module.exports = {
  addTestWizard,
  takeTestWizard,
  registerTestDeleteHandlers,
  ADD_TEST_SCENE_ID,
  TAKE_TEST_SCENE_ID,
};
