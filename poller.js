require('dotenv').config();
const { Client } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

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

  discord.login(process.env.DISCORD_TOKEN);
  discord.once('ready', async () => {
    for (const rem of data) {
      try {
        const channel = await discord.channels.fetch(rem.channel_id);
        await channel.send(`<@${rem.user_id}> ⏰ ถึงเวลาเตือนเรื่อง **${rem.stock.toUpperCase()}** แล้ว!`);
      } catch (e) {
        console.error('❌ Error sending reminder:', e);
      }

      await supabase.from('reminders').delete().eq('id', rem.id);
    }

    discord.destroy();
  });
})();
