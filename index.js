import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
} from 'discord.js';
import { config, validateConfig } from './config.js';
import { registerCommands } from './commands.js';
import { verifiedUsers } from './database.js';

import {
  handleMemberJoin,
  postVerificationPanel,
  handleVerifyStart,
  handleVerifyApprove,
  handleVerifyReject,
  handleCallsignSubmit,
} from './features/verification.js';

import {
  postTicketPanel,
  handleTicketCreate,
  handleTicketClose,
  handleTicketClaim,
} from './features/ticket.js';

import { sendAnnouncement } from './features/announcement.js';
import {
  startRssScheduler,
  checkRssFeed,
  postLatestRss,
  previewLatestRss,
  resetRssCache,
} from './features/rss.js';
import {
  banMember,
  kickMember,
  timeoutMember,
  untimeoutMember,
  unbanMember,
} from './features/moderation.js';
import {
  ensureCountryRoles,
  postCountryPanel,
  handleCountrySelect,
} from './features/countryRoles.js';

validateConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// ========== READY ==========
client.once(Events.ClientReady, async (c) => {
  console.log(`\n🎙️  HAMTHAILAND Bot Online — ${c.user.tag}`);
  console.log(`📡 เซิร์ฟเวอร์: ${c.guilds.cache.size}`);

  c.user.setActivity('HAMTHAILAND.ORG | /help', { type: 3 }); // WATCHING

  // Register slash commands
  await registerCommands();

  // สร้างยศประเทศอัตโนมัติตอนเริ่มต้น
  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (guild) {
    await ensureCountryRoles(guild);
  } else {
    console.warn('⚠️  ไม่พบ guild ตาม GUILD_ID');
  }

  // เริ่ม RSS scheduler
  if (config.channels.rss) {
    startRssScheduler(client);
  } else {
    console.warn('⚠️  ไม่ได้ตั้ง RSS_CHANNEL_ID — ข้าม RSS scheduler');
  }
});

// ========== MEMBER JOIN ==========
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== config.guildId) return;
  await handleMemberJoin(member);
});

// ========== INTERACTION HANDLER ==========
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // --- Slash Commands ---
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    // --- Buttons ---
    if (interaction.isButton()) {
      const id = interaction.customId;

      if (id === 'verify_start') return handleVerifyStart(interaction);
      if (id.startsWith('verify_approve:')) return handleVerifyApprove(interaction);
      if (id.startsWith('verify_reject:')) return handleVerifyReject(interaction);
      if (id === 'ticket_close') return handleTicketClose(interaction);
      if (id === 'ticket_claim') return handleTicketClaim(interaction);
      return;
    }

    // --- Select Menus ---
    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'ticket_create') return handleTicketCreate(interaction);
      if (id.startsWith('country_select:')) return handleCountrySelect(interaction);
      return;
    }

    // --- Modals ---
    if (interaction.isModalSubmit()) {
      const id = interaction.customId;
      if (id.startsWith('verify_callsign_modal:')) return handleCallsignSubmit(interaction);
      return;
    }
  } catch (err) {
    console.error('Interaction error:', err);
    const reply = { content: `❌ เกิดข้อผิดพลาด: ${err.message}`, ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// ========== SLASH COMMAND HANDLER ==========
async function handleSlashCommand(interaction) {
  const { commandName } = interaction;

  switch (commandName) {
    // --- Setup ---
    case 'setup-verify':
      await postVerificationPanel(interaction.channel);
      return interaction.reply({ content: '✅ โพสต์ panel ยืนยันตัวตนแล้ว', ephemeral: true });

    case 'setup-ticket':
      await postTicketPanel(interaction.channel);
      return interaction.reply({ content: '✅ โพสต์ panel ticket แล้ว', ephemeral: true });

    case 'setup-country':
      await postCountryPanel(interaction.channel);
      return interaction.reply({ content: '✅ โพสต์ panel เลือกประเทศแล้ว', ephemeral: true });

    case 'setup-country-roles':
      await interaction.deferReply({ ephemeral: true });
      await ensureCountryRoles(interaction.guild);
      return interaction.editReply('✅ สร้างยศประเทศเรียบร้อย');

    // --- Announcement ---
    case 'announce': {
      await interaction.deferReply({ ephemeral: true });
      return sendAnnouncement(interaction, {
        title: interaction.options.getString('title'),
        content: interaction.options.getString('content'),
        mention: interaction.options.getString('mention') || 'none',
        imageUrl: interaction.options.getString('image'),
        color: interaction.options.getString('color') || '#1ABC9C',
      });
    }

    // --- Moderation ---
    case 'ban': {
      await interaction.deferReply();
      return banMember(
        interaction,
        interaction.options.getUser('user'),
        interaction.options.getString('reason'),
        interaction.options.getInteger('delete_days') || 0
      );
    }

    case 'unban': {
      await interaction.deferReply({ ephemeral: true });
      return unbanMember(
        interaction,
        interaction.options.getString('user_id'),
        interaction.options.getString('reason') || 'ไม่ระบุ'
      );
    }

    case 'kick': {
      await interaction.deferReply();
      return kickMember(
        interaction,
        interaction.options.getUser('user'),
        interaction.options.getString('reason')
      );
    }

    case 'timeout': {
      await interaction.deferReply();
      return timeoutMember(
        interaction,
        interaction.options.getUser('user'),
        interaction.options.getInteger('minutes'),
        interaction.options.getString('reason')
      );
    }

    case 'untimeout': {
      await interaction.deferReply({ ephemeral: true });
      return untimeoutMember(interaction, interaction.options.getUser('user'));
    }

    // --- RSS ---
    case 'rss-check': {
      await interaction.deferReply({ ephemeral: true });
      const result = await checkRssFeed(client);
      if (!result.ok) {
        return interaction.editReply(`❌ ตรวจไม่สำเร็จ: ${result.reason} ${result.error || ''}`);
      }
      if (result.initialized) {
        return interaction.editReply(
          `✅ บันทึก ${result.initialized} รายการเริ่มต้นใน cache (ไม่ส่งสแปม)`
        );
      }
      if (result.sent === 0) {
        return interaction.editReply('ℹ️ ไม่มีข่าวใหม่');
      }
      return interaction.editReply(`✅ ส่งข่าวใหม่ ${result.sent} รายการเรียบร้อย`);
    }

    case 'rss-test': {
      await interaction.deferReply({ ephemeral: true });
      const count = interaction.options.getInteger('count') || 1;
      const result = await postLatestRss(client, count);
      if (!result.ok) {
        return interaction.editReply(`❌ ทดสอบไม่สำเร็จ: ${result.reason} ${result.error || ''}`);
      }
      return interaction.editReply(
        `✅ โพสต์ข่าวล่าสุด ${result.sent}/${count} รายการ ลงที่ <#${config.channels.rss}> เรียบร้อย\n` +
          `📊 มีข่าวทั้งหมด ${result.total} รายการใน feed`
      );
    }

    case 'rss-preview': {
      await interaction.deferReply({ ephemeral: true });
      const count = interaction.options.getInteger('count') || 1;
      const result = await previewLatestRss(count);
      if (!result.ok) {
        return interaction.editReply(`❌ Preview ไม่สำเร็จ: ${result.reason} ${result.error || ''}`);
      }
      return interaction.editReply({
        content: `📋 ตัวอย่าง ${result.embeds.length} ข่าวล่าสุด (จากทั้งหมด ${result.total} รายการ)`,
        embeds: result.embeds,
      });
    }

    case 'rss-reset': {
      await interaction.deferReply({ ephemeral: true });
      resetRssCache();
      return interaction.editReply(
        '✅ ล้าง cache เรียบร้อย\n' +
          '⚠️ ครั้งหน้าที่ตรวจ feed บอทจะ "เริ่มต้นใหม่" — บันทึกข่าวปัจจุบันลง cache โดยไม่ส่ง\n' +
          'ถ้าต้องการให้ส่งจริง ใช้ `/rss-test` แทน'
      );
    }

    // --- Whois ---
    case 'whois': {
      const target = interaction.options.getUser('user') || interaction.user;
      const data = verifiedUsers.read()[target.id];

      const embed = new EmbedBuilder()
        .setTitle(`📡 ข้อมูลสมาชิก`)
        .setThumbnail(target.displayAvatarURL())
        .addFields({ name: 'Discord', value: `<@${target.id}>`, inline: true });

      if (data) {
        embed
          .setColor('#27AE60')
          .addFields(
            { name: 'นามเรียกขาน', value: data.callsign, inline: true },
            {
              name: 'ยืนยันเมื่อ',
              value: `<t:${Math.floor(data.verifiedAt / 1000)}:R>`,
              inline: true,
            }
          );
      } else {
        embed.setColor('#95A5A6').setDescription('ยังไม่ได้ยืนยันตัวตนเป็นนักวิทยุสมัครเล่น');
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // --- Help ---
    case 'help': {
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('📖 คำสั่งของ HAMTHAILAND Bot')
        .addFields(
          {
            name: '⚙️ Setup (Admin)',
            value:
              '`/setup-verify` - โพสต์ panel ยืนยันตัวตน\n' +
              '`/setup-ticket` - โพสต์ panel ticket\n' +
              '`/setup-country` - โพสต์ panel เลือกประเทศ\n' +
              '`/setup-country-roles` - สร้างยศประเทศใหม่',
          },
          {
            name: '📢 ประกาศ',
            value: '`/announce` - ส่งประกาศ',
          },
          {
            name: '🔨 จัดการสมาชิก',
            value:
              '`/ban` `/unban` `/kick` `/timeout` `/untimeout`',
          },
          {
            name: '📰 RSS',
            value:
              '`/rss-check` - ตรวจหาข่าวใหม่\n' +
              '`/rss-test [count]` - โพสต์ข่าวล่าสุดเพื่อทดสอบ\n' +
              '`/rss-preview [count]` - ดูตัวอย่าง embed\n' +
              '`/rss-reset` - ล้าง cache',
          },
          {
            name: '🔍 ทั่วไป',
            value: '`/whois` - ดูข้อมูลนักวิทยุสมัครเล่น\n`/help` - แสดงคำสั่ง',
          }
        )
        .setFooter({ text: 'HAMTHAILAND.ORG' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

// ========== ERROR HANDLING ==========
client.on('error', (err) => console.error('Client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

client.login(config.token);