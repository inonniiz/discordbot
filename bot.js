require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function parseDuration(durationStr) {
  const regex = /(\d+)(d|h|m)/g;
  let match;
  let totalMs = 0;

  while ((match = regex.exec(durationStr)) !== null) {
    const [_, num, unit] = match;
    const n = parseInt(num);
    if (unit === 'd') totalMs += n * 24 * 60 * 60 * 1000;
    if (unit === 'h') totalMs += n * 60 * 60 * 1000;
    if (unit === 'm') totalMs += n * 60 * 1000;
  }

  return new Date(Date.now() + totalMs);
}

client.on('messageCreate', async message => {
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(' ');
  const command = args.shift().toLowerCase();

  if (command === 'remindme') {
    const [stock, ...durationParts] = args;
    const durationStr = durationParts.join('');
    const remindAt = parseDuration(durationStr);

    if (!stock || !remindAt) {
      return message.reply('❗ รูปแบบคำสั่ง: `!remindme <stock> <duration>` เช่น `!remindme ccsi 1d3h`');
    }

    const id = uuidv4();
    const short_id = id.slice(0, 6);

    const { error } = await supabase.from('reminders').insert({
      id,
      short_id,
      user_id: message.author.id,
      channel_id: message.channel.id,
      stock: stock.toUpperCase(),
      remind_at: remindAt.toISOString(),
    });

    if (error) {
      console.error(error);
      return message.reply('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }

    return message.reply(`🕒 ตั้งเตือนสำหรับ ${stock.toUpperCase()} ใน ${durationStr} แล้ว (ID: \`${short_id}\`)`);
  }

  if (command === 'reminders') {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', message.author.id);

    if (error || !data || data.length === 0) {
      return message.reply('🔍 คุณไม่มี reminder ตอนนี้');
    }

    const lines = data.map(rem => {
      const date = new Date(rem.remind_at).toLocaleString();
      return `🆔 \`${rem.short_id}\` | ${rem.stock.toUpperCase()} → ${date}`;
    });

    return message.reply(`📋 Reminder ของคุณ:
${lines.join('\n')}`);
  }

  if (command === 'cancel') {
    const short_id = args[0];
    if (!short_id) return message.reply('❗ ใช้แบบนี้: `!cancel <id>`');

    const { error } = await supabase
      .from('reminders')
      .delete()
      .match({ user_id: message.author.id, short_id });

    if (error) {
      console.error(error);
      return message.reply('❌ ลบไม่สำเร็จ หรือไม่พบ ID ดังกล่าว');
    }

    return message.reply(`✅ ลบ reminder ID \`${short_id}\` แล้ว`);
  }
});

client.login(process.env.DISCORD_TOKEN);
