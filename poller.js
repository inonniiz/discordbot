require('dotenv').config();
const { Client } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const discord = new Client({ intents: [] });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

(async () => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .lte('remind_at', now);

  if (error) {
    console.error('❌ Error fetching reminders:', error);
    process.exit(1);
  }

  if (!data.length) {
    console.log('✅ No reminders due.');
    process.exit(0);
  }

  discord.login(process.env.DISCORD_TOKEN);

  discord.once('ready', async () => {
    for (const rem of data) {
      try {
        const channel = await discord.channels.fetch(rem.channel_id);
        let message = `<@${rem.user_id}> ⏰ ถึงเวลาเตือนเรื่อง **${rem.stock.toUpperCase()}**`;

        let price_now = null;
        try {
          const res = await axios.get(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${rem.stock}`);
          price_now = res.data.quoteResponse.result[0]?.regularMarketPrice;
        } catch (e) {
          console.error(`⚠️ ดึงราคาปัจจุบันของ ${rem.stock} ไม่สำเร็จ`);
        }

        const price_before = rem.price_at_creation;
        let pct = null;
        if (price_before && price_now) {
          pct = (((price_now - price_before) / price_before) * 100).toFixed(2);
        }

        message += `\n📝 ข้อความ: _${rem.note || 'ไม่มี'}_`;
        message += `\n💰 ราคาเมื่อสร้าง: **$${price_before}**`;
        if (price_now) {
          message += `\n📈 ราคาปัจจุบัน: **$${price_now}** (${pct >= 0 ? '+' : ''}${pct}%)`;
        }

        await channel.send(message);
      } catch (e) {
        console.error('❌ Error sending reminder:', e);
      }

      await supabase.from('reminders').delete().eq('id', rem.id);
    }

    discord.destroy();
  });
})();
