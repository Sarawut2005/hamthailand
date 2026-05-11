import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
} from 'discord.js';
import http from 'http'; // เพิ่มการนำเข้า http
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

  await registerCommands();

  const guild = await client.guilds.fetch(config.guildId).catch(() => null);
  if (guild) {
    await ensureCountryRoles(guild);
  } else {
    console.warn('⚠️  ไม่พบ guild ตาม GUILD_ID');
  }

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
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'verify_start') return handleVerifyStart(interaction);
      if (id.startsWith('verify_approve:')) return handleVerifyApprove(interaction);
      if (id.startsWith('verify_reject:')) return handleVerifyReject(interaction);
      if (id === 'ticket_close') return handleTicketClose(interaction);
      if (id === 'ticket_claim') return handleTicketClaim(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'ticket_create') return handleTicketCreate(interaction);
      if (id.startsWith('country_select:')) return handleCountrySelect(interaction);
      return;
    }

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

    case 'rss-check': {
      await interaction.deferReply({ ephemeral: true });
      const result = await checkRssFeed(client);
      if (!result.ok) {
        return interaction.editReply(`❌ ตรวจไม่สำเร็จ: ${result.reason} ${result.error || ''}`);
      }
      if (result.initialized) {
        return interaction.editReply(`✅ บันทึก ${result.initialized} รายการเริ่มต้นใน cache (ไม่ส่งสแปม)`);
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
      return interaction.editReply('✅ ล้าง cache เรียบร้อย');
    }

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
            { name: 'ยืนยันเมื่อ', value: `<t:${Math.floor(data.verifiedAt / 1000)}:R>`, inline: true }
          );
      } else {
        embed.setColor('#95A5A6').setDescription('ยังไม่ได้ยืนยันตัวตน');
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    case 'help': {
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('📖 คำสั่งของ HAMTHAILAND Bot')
        .setDescription('คู่มือการใช้งานคำสั่งต่างๆ')
        .setFooter({ text: 'HAMTHAILAND.ORG' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

// ========== ADDED FOR RENDER.COM ==========
// สร้าง HTTP Server เพื่อให้ Render สามารถตรวจจับพอร์ตได้
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('HAMTHAILAND Discord Bot is running!');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Health check server is listening on port ${PORT}`);
});
// ==========================================

client.on('error', (err) => console.error('Client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

client.login(config.token);
