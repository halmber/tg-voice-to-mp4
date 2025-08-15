import "dotenv/config";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import fetch from "node-fetch";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import express from "express";

const __dirname = path.resolve();

//const GROUP_CHAT_ID = Number(process.env.GROUP_CHAT_ID) || 0;
const BOT_TOKEN = process.env.BOT_TOKEN || "";

if (!BOT_TOKEN)
  throw new Error("BOT_TOKEN is not set in environment variables");

const bot = new Telegraf(BOT_TOKEN);

ffmpeg.setFfmpegPath(ffmpegPath as string);

bot.start(async (ctx) => {
  await ctx.reply(
    `👋 Привіт, ${ctx.from.first_name}! Надішли мені голосове повідомлення, і я сконвертую його у MP4.`,
  );
});

bot.on(message("voice"), async (ctx) => {
  try {
    const fileId = ctx.message.voice.file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    const inputPath = path.join(__dirname, "voice.oga");
    const outputPath = path.join(__dirname, "voice.mp4");

    const res = await fetch(fileUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions("-movflags faststart")
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    await ctx.replyWithVideo({ source: outputPath });

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (err) {
    console.error(err);
    ctx.reply("❌ Сталася помилка під час обробки голосового.");
  }
});

if (process.env.NODE_ENV === "development") {
  try {
    bot.launch();
    console.log("🤖 Бот запущений у режимі розробки...");
  } catch (error) {
    console.error("❌ Помилка запуску бота:", error);
  }
} else {
  const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN || "";
  const PORT = Number(process.env.PORT) || 4000;
  if (!WEBHOOK_DOMAIN) throw new Error("WEBHOOK_DOMAIN is not set");

  const app = express();
  app.use(express.json());
  app.use(
    await bot.createWebhook({
      domain: `${WEBHOOK_DOMAIN}`,
    }),
  );

  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущено на порту ${PORT}`);
  });
}
