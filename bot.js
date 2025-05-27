require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ===== Duration Parser =====
function parseDuration(durationStr) {
  const regex = /(\d+)(d|h|m)/g;
  let match;
  let totalMs = 0;
  let matched = false;

  while ((match = regex.exec(durationStr)) !== null) {
    matched = true;
    const [_, num, unit] = match;
    const n = parseInt(num);
    if (unit === 'd') totalMs += n * 24 * 60 * 60 * 1000;
    if (unit === 'h') totalMs += n * 60 * 60 * 1000;
    if (unit === 'm') totalMs += n * 60 * 1000;
  }

  return matched ? new Date(Date.now() + totalMs) : null;
}

// ===== Discord Bot Commands =====
client.on('messageCreate', async message => {
  if (!message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(' ');
  const command = args.shift().toLowerCase();

  if (command === 'remindme') {
    const [stock, duration, ...noteParts] = args;
    const note = noteParts.join(' ').replace(/^"|"$/g, ''); // Strip outer quotes
    const remindAt = parseDuration(duration);

    if (!stock || !remindAt || remindAt <= new Date()) {
      return message.reply('❗ ใช้รูปแบบ `!remindme <stock> <duration> "<note>"` เช่น `!remindme tsla 1d2h "จับตาข่าวทรัมป์"` โดยเวลาต้องเป็นอนาคต');
    }

    let price = null;
    try {
      const res = await axios.get(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${stock}`);
      price = res.data.quoteResponse.result[0]?.regularMarketPrice;
      if (!price) throw new Error('Invalid stock');
    } catch (e) {
      return message.reply('⚠️ ไม่สามารถดึงราคาหุ้นได้ กรุณาตรวจสอบชื่อหุ้น');
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
      note,
      price_at_creation: price,
    });

    if (error) {
      console.error(error);
      return message.reply('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }

    return message.reply(`🕒 ตั้งเตือนสำหรับ **${stock.toUpperCase()}** ใน ${duration} (ID: \`${short_id}\`)\n💰 ราคาปัจจุบัน: **$${price}**\n📝 ข้อความ: _${note || 'ไม่มี'}_`);
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
      return `🆔 \`${rem.short_id}\` | ${rem.stock.toUpperCase()} → ${date} | 📝 ${rem.note || 'ไม่มี'}`;
    });

    return message.reply(`📋 Reminder ของคุณ:\n${lines.join('\n')}`);
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
