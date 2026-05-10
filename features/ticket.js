import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { tickets } from '../database.js';

const TICKET_TOPICS = [
  { label: 'สอบถามทั่วไป', value: 'general', emoji: '❓' },
  { label: 'รายงานปัญหา/บั๊ก', value: 'bug', emoji: '🐛' },
  { label: 'แจ้งเรื่องสมาชิก', value: 'report', emoji: '⚠️' },
  { label: 'อุทธรณ์การแบน', value: 'appeal', emoji: '🔓' },
  { label: 'อื่น ๆ', value: 'other', emoji: '📋' },
];

/**
 * โพสต์ panel สำหรับเปิด ticket (รันด้วย /setup-ticket)
 */
export async function postTicketPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🎫 ระบบติดต่อแอดมิน (Ticket)')
    .setDescription(
      'หากต้องการติดต่อแอดมินเป็นการส่วนตัว กดปุ่มด้านล่างเพื่อเปิด Ticket\n\n' +
        'เลือกหัวข้อที่เหมาะสม เพื่อให้แอดมินตอบคำถามได้รวดเร็วยิ่งขึ้น\n\n' +
        '⚠️ **ห้ามเปิด Ticket เพื่อการก่อกวน** — จะถูกลงโทษตามกฎของเซิร์ฟเวอร์'
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket_create')
    .setPlaceholder('เลือกหัวข้อที่ต้องการติดต่อ...')
    .addOptions(TICKET_TOPICS);

  const row = new ActionRowBuilder().addComponents(select);
  await channel.send({ embeds: [embed], components: [row] });
}

/**
 * สร้าง ticket channel ใหม่
 */
export async function handleTicketCreate(interaction) {
  const topic = interaction.values[0];
  const topicInfo = TICKET_TOPICS.find((t) => t.value === topic);
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  // เช็คว่ามี ticket เปิดอยู่แล้วหรือไม่
  const allTickets = tickets.read();
  const existing = Object.entries(allTickets).find(([, t]) => t.userId === userId && !t.closed);
  if (existing) {
    return interaction.editReply(
      `❌ คุณมี Ticket ที่ยังเปิดอยู่ที่ <#${existing[0]}> กรุณาปิด ticket เดิมก่อน`
    );
  }

  const guild = interaction.guild;
  const ticketName = `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');

  try {
    const ticketChannel = await guild.channels.create({
      name: ticketName,
      type: ChannelType.GuildText,
      parent: config.channels.ticketCategory || null,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        },
        {
          id: config.roles.admin,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages,
          ],
        },
      ],
    });

    // บันทึก ticket
    tickets.update((data) => {
      data[ticketChannel.id] = {
        userId,
        topic,
        createdAt: Date.now(),
        closed: false,
      };
      return data;
    });

    const welcomeEmbed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`${topicInfo.emoji} ${topicInfo.label}`)
      .setDescription(
        `สวัสดี <@${userId}>\n\n` +
          `กรุณาอธิบายเรื่องที่ต้องการติดต่อโดยละเอียด แอดมินจะมาตอบโดยเร็วที่สุด\n\n` +
          `เมื่อแก้ไขปัญหาเรียบร้อย กดปุ่ม **🔒 ปิด Ticket** ด้านล่างได้เลย`
      );

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close')
        .setLabel('🔒 ปิด Ticket')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_claim')
        .setLabel('✋ รับเรื่อง (แอดมิน)')
        .setStyle(ButtonStyle.Primary)
    );

    await ticketChannel.send({
      content: `<@${userId}> <@&${config.roles.admin}>`,
      embeds: [welcomeEmbed],
      components: [closeRow],
    });

    await interaction.editReply(`✅ เปิด Ticket แล้ว: <#${ticketChannel.id}>`);
  } catch (err) {
    console.error('Ticket create error:', err);
    await interaction.editReply('❌ ไม่สามารถสร้าง Ticket ได้: ' + err.message);
  }
}

/**
 * รับเรื่อง ticket (แอดมิน)
 */
export async function handleTicketClaim(interaction) {
  if (!interaction.member.roles.cache.has(config.roles.admin)) {
    return interaction.reply({ content: '❌ เฉพาะแอดมินเท่านั้น', ephemeral: true });
  }

  await interaction.reply({
    content: `✋ <@${interaction.user.id}> รับเรื่อง ticket นี้แล้ว`,
  });
}

/**
 * ปิด ticket + log transcript
 */
export async function handleTicketClose(interaction) {
  const channel = interaction.channel;
  const ticketData = tickets.read()[channel.id];
  if (!ticketData) {
    return interaction.reply({ content: '❌ ไม่ใช่ ticket channel', ephemeral: true });
  }

  // เฉพาะเจ้าของ ticket หรือแอดมิน
  const isOwner = ticketData.userId === interaction.user.id;
  const isAdmin = interaction.member.roles.cache.has(config.roles.admin);
  if (!isOwner && !isAdmin) {
    return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ปิด ticket นี้', ephemeral: true });
  }

  await interaction.reply('🔒 กำลังปิด ticket... จะลบห้องใน 10 วินาที');

  // สร้าง transcript
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const transcript = messages
      .reverse()
      .map((m) => {
        const time = new Date(m.createdTimestamp).toLocaleString('th-TH');
        const attachments = m.attachments.map((a) => a.url).join(', ');
        return `[${time}] ${m.author.tag}: ${m.content}${attachments ? ' [📎 ' + attachments + ']' : ''}`;
      })
      .join('\n');

    const transcriptBuffer = Buffer.from(transcript, 'utf-8');
    const file = new AttachmentBuilder(transcriptBuffer, { name: `${channel.name}.txt` });

    const logChannel = await interaction.guild.channels
      .fetch(config.channels.ticketLog)
      .catch(() => null);

    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle(`🗂️ Ticket ปิดแล้ว: ${channel.name}`)
        .addFields(
          { name: 'เจ้าของ', value: `<@${ticketData.userId}>`, inline: true },
          { name: 'ปิดโดย', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'หัวข้อ', value: ticketData.topic, inline: true }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed], files: [file] });
    }

    tickets.update((data) => {
      if (data[channel.id]) data[channel.id].closed = true;
      return data;
    });
  } catch (err) {
    console.error('Transcript error:', err);
  }

  setTimeout(() => channel.delete().catch(() => {}), 10000);
}
