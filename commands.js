import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
} from 'discord.js';
import { config } from './config.js';

export const commands = [
  // === Setup Commands (Admin) ===
  new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('โพสต์ panel ระบบยืนยันตัวตนในห้องนี้')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('โพสต์ panel ระบบ ticket ในห้องนี้')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setup-country')
    .setDescription('โพสต์ panel เลือกประเทศในห้องนี้')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setup-country-roles')
    .setDescription('สร้างยศประเทศทั้งหมดในเซิร์ฟเวอร์')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // === Announcement ===
  new SlashCommandBuilder()
    .setName('announce')
    .setDescription('ส่งประกาศไปยังห้องประกาศ')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((opt) =>
      opt.setName('title').setDescription('หัวข้อประกาศ').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('content').setDescription('เนื้อหาประกาศ').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('mention')
        .setDescription('แท็กใคร')
        .addChoices(
          { name: 'ไม่แท็ก', value: 'none' },
          { name: '@everyone', value: 'everyone' },
          { name: '@here', value: 'here' },
          { name: 'นักวิทยุสมัครเล่น', value: 'ham' }
        )
    )
    .addStringOption((opt) =>
      opt.setName('image').setDescription('URL รูปภาพ (ถ้ามี)')
    )
    .addStringOption((opt) =>
      opt.setName('color').setDescription('สี hex เช่น #FF0000 (ไม่ใส่ก็ได้)')
    ),

  // === Moderation ===
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('แบนสมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('สมาชิก').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('เหตุผล').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('delete_days')
        .setDescription('ลบข้อความย้อนหลัง (วัน, 0-7)')
        .setMinValue(0)
        .setMaxValue(7)
    ),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('ปลดแบนสมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((opt) =>
      opt.setName('user_id').setDescription('User ID').setRequired(true)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('เหตุผล')),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('เตะสมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('สมาชิก').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('เหตุผล').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout สมาชิก (mute ชั่วคราว)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('สมาชิก').setRequired(true))
    .addIntegerOption((opt) =>
      opt
        .setName('minutes')
        .setDescription('ระยะเวลา (นาที, สูงสุด 40320 = 28 วัน)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40320)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('เหตุผล').setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('ปลด timeout สมาชิก')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('user').setDescription('สมาชิก').setRequired(true)),

  // === RSS ===
  new SlashCommandBuilder()
    .setName('rss-check')
    .setDescription('สั่งตรวจ RSS feed ทันที (ส่งเฉพาะข่าวใหม่)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('rss-test')
    .setDescription('ทดสอบ — โพสต์ข่าวล่าสุดที่มีอยู่ลงห้อง RSS (ข้าม cache)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((opt) =>
      opt
        .setName('count')
        .setDescription('จำนวนข่าวล่าสุดที่จะโพสต์ (default 1)')
        .setMinValue(1)
        .setMaxValue(10)
    ),

  new SlashCommandBuilder()
    .setName('rss-preview')
    .setDescription('แสดงตัวอย่าง embed ของข่าวล่าสุด (เฉพาะคุณเห็น)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((opt) =>
      opt
        .setName('count')
        .setDescription('จำนวนข่าวที่จะ preview (default 1, max 3)')
        .setMinValue(1)
        .setMaxValue(3)
    ),

  new SlashCommandBuilder()
    .setName('rss-reset')
    .setDescription('ล้าง cache RSS (ครั้งหน้าจะเริ่มต้นใหม่)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  // === Info ===
  new SlashCommandBuilder()
    .setName('whois')
    .setDescription('ดูข้อมูลนักวิทยุสมัครเล่น')
    .addUserOption((opt) => opt.setName('user').setDescription('สมาชิก')),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('แสดงคำสั่งทั้งหมด'),
].map((c) => c.toJSON());

/**
 * Register slash commands กับ Discord API
 */
export async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    console.log('🔄 กำลัง register slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log(`✅ Register สำเร็จ ${commands.length} commands`);
  } catch (err) {
    console.error('❌ Register commands ล้มเหลว:', err);
  }
}