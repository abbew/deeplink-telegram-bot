const puppeteer = require('puppeteer');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const token = 'YOUR_TELEGRAM_BOT_TOKEN';
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Bot sedang berjalan...');

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || !text.includes('atid.me')) return;

  const links = text.split(/\s|\n/).filter(link => link.includes('atid.me'));

  await bot.sendMessage(chatId, `🔍 Memproses ${links.length} URL...`);

  let allDeeplinks = [];

  for (const link of links) {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: {
          width: 360,
          height: 740,
          isMobile: true,
          hasTouch: true
        },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Linux; Android 7.0; SM-G950F Build/NRD90M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.84 Mobile Safari/537.36');

      const deeplinks = [];

      page.on('response', async (response) => {
        const url = response.url();
        if (url.startsWith('https://snssdk1180.onelink.me')) {
          const headers = response.headers();
          if (headers['content-type']?.includes('text/html')) {
            try {
              const html = await response.text();
              const match = html.match(/var app_link = '([^']+)'/);
              if (match) deeplinks.push(match[1]);
            } catch (err) {
              console.error('Gagal parsing HTML:', err.message);
            }
          }
        }
      });

      await page.goto(link, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const clicked = await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll('span')).find(el => el.innerText.includes('Shop now in app'));
        if (span) {
          span.click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        await bot.sendMessage(chatId, `⚠️ Tombol tidak ditemukan di: ${link}`);
      } else {
        console.log(`🖱️ Klik tombol berhasil di: ${link}`);
      }

      await new Promise(resolve => setTimeout(resolve, 4000));
      await browser.close();

      if (deeplinks.length > 0) {
        const fixed = `urls[${allDeeplinks.length}] = "${deeplinks[0].replace('intent://', 'snssdk1180://')}";`;
        allDeeplinks.push(fixed);
      } else {
        await bot.sendMessage(chatId, `❌ Deeplink tidak ditemukan di: ${link}`);
      }

    } catch (error) {
      console.error(`❌ Error di link ${link}:`, error.message);
      await bot.sendMessage(chatId, `❌ Gagal memproses: ${link}\nError: ${error.message}`);
    }
  }

  if (allDeeplinks.length > 0) {
    fs.writeFileSync('deeplink.txt', allDeeplinks.join('\n'));
    await bot.sendMessage(chatId, `✅ ${allDeeplinks.length} deeplink ditemukan.`, {
      reply_markup: {
        inline_keyboard: [[{ text: '⬇️ Download .txt', callback_data: 'download_txt' }]]
      }
    });
  } else {
    await bot.sendMessage(chatId, '❌ Tidak ada deeplink yang ditemukan.');
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;

  if (callbackQuery.data === 'download_txt') {
    if (fs.existsSync('deeplink.txt')) {
      await bot.sendDocument(chatId, 'deeplink.txt');
    } else {
      await bot.sendMessage(chatId, '❌ File tidak ditemukan.');
    }
  }
});
