import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config.js';
import { verifications, verifiedUsers } from '../database.js';

/**
 * เมื่อสมาชิกใหม่เข้าเซิร์ฟเวอร์ → ให้ยศบุคคลทั่วไป + ส่ง DM แนะนำ
 */
export async function handleMemberJoin(member) {
  try {
    if (config.roles.general) {
      await member.roles.add(config.roles.general).catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🎙️ ยินดีต้อนรับสู่ HAMTHAILAND.ORG')
      .setDescription(
        `สวัสดี ${member.user.username}!\n\n` +
          `คุณได้รับยศ **บุคคลทั่วไป** เรียบร้อยแล้ว\n\n` +
          `📡 **หากคุณเป็นนักวิทยุสมัครเล่น**\n` +
          `กรุณาไปที่ห้อง <#${config.channels.verification}> เพื่อยืนยันตัวตน\n` +
          `โดยส่งรูปบัตรพนักงานวิทยุสมัครเล่นและรอแอดมินตรวจสอบ\n\n` +
          `เมื่อยืนยันแล้วคุณจะได้รับยศ **นักวิทยุสมัครเล่น** พร้อมนามเรียกขาน`
      )
      .setTimestamp();

    await member.send({ embeds: [embed] }).catch(() => {
      // ผู้ใช้ปิด DM ไว้ ไม่เป็นไร
    });
  } catch (err) {
    console.error('handleMemberJoin error:', err);
  }
}

/**
 * โพสต์ข้อความตั้งต้นในห้องยืนยันตัวตน (รันด้วยคำสั่ง /setup-verify)
 */
export async function postVerificationPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle('📡 ระบบยืนยันตัวตนนักวิทยุสมัครเล่น')
    .setDescription(
      'หากคุณเป็นนักวิทยุสมัครเล่น สามารถยื่นยืนยันตัวตนได้ที่นี่\n\n' +
        '**วิธีการ:**\n' +
        '1. กดปุ่ม **📷 ส่งบัตรเพื่อยืนยัน** ด้านล่าง\n' +
        '2. แนบรูปบัตรพนักงานวิทยุสมัครเล่น (ปกปิดข้อมูลส่วนตัวที่ไม่จำเป็นได้)\n' +
        '3. รอแอดมินตรวจสอบและกรอกนามเรียกขาน\n' +
        '4. คุณจะได้รับยศ **นักวิทยุสมัครเล่น**\n\n' +
        '⚠️ ข้อมูลของคุณจะถูกใช้เพื่อการตรวจสอบเท่านั้น'
    )
    .setFooter({ text: 'HAMTHAILAND.ORG' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_start')
      .setLabel('📷 ส่งบัตรเพื่อยืนยัน')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

/**
 * เมื่อกดปุ่มเริ่มยืนยัน → ตอบกลับให้ส่งรูปในห้องเดียวกันภายใน 5 นาที
 */
export async function handleVerifyStart(interaction) {
  const userId = interaction.user.id;

  // เช็คว่ายืนยันแล้วหรือยัง
  const verified = verifiedUsers.read();
  if (verified[userId]) {
    return interaction.reply({
      content: `✅ คุณยืนยันตัวตนแล้ว นามเรียกขาน: **${verified[userId].callsign}**`,
      ephemeral: true,
    });
  }

  await interaction.reply({
    content:
      '📷 กรุณาส่งรูปบัตรพนักงานวิทยุสมัครเล่นในห้องนี้ภายใน **5 นาที**\n' +
      '> รูปต้องชัดเจน อ่านนามเรียกขานได้\n' +
      '> สามารถเซ็นเซอร์ข้อมูลส่วนตัวที่ไม่จำเป็นได้',
    ephemeral: true,
  });

  // รอข้อความจากผู้ใช้คนนี้ที่มีรูปแนบ
  const filter = (m) => m.author.id === userId && m.attachments.size > 0;
  try {
    const collected = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 5 * 60 * 1000,
      errors: ['time'],
    });

    const msg = collected.first();
    const attachment = msg.attachments.first();

    // ตรวจว่าเป็นรูปภาพ
    if (!attachment.contentType?.startsWith('image/')) {
      await msg.reply('❌ กรุณาส่งเป็นรูปภาพเท่านั้น');
      return;
    }

    await submitVerification(interaction, attachment.url, msg);
  } catch (err) {
    await interaction.followUp({
      content: '⏰ หมดเวลาแล้ว กรุณากดปุ่มใหม่อีกครั้ง',
      ephemeral: true,
    });
  }
}

/**
 * ส่งคำขอยืนยันไปให้แอดมินรีวิว
 */
async function submitVerification(interaction, imageUrl, userMessage) {
  const adminChannel = await interaction.guild.channels
    .fetch(config.channels.adminReview)
    .catch(() => null);

  if (!adminChannel) {
    await userMessage.reply('❌ ระบบขัดข้อง กรุณาแจ้งแอดมิน');
    return;
  }

  const embed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🔍 คำขอยืนยันตัวตนใหม่')
    .setDescription(`**ผู้ขอ:** <@${interaction.user.id}> (\`${interaction.user.tag}\`)`)
    .setImage(imageUrl)
    .setFooter({ text: `User ID: ${interaction.user.id}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify_approve:${interaction.user.id}`)
      .setLabel('✅ อนุมัติ + ใส่นามเรียกขาน')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`verify_reject:${interaction.user.id}`)
      .setLabel('❌ ปฏิเสธ')
      .setStyle(ButtonStyle.Danger)
  );

  const adminMsg = await adminChannel.send({ embeds: [embed], components: [row] });

  // บันทึกคำขอ
  verifications.update((data) => {
    data[adminMsg.id] = {
      userId: interaction.user.id,
      imageUrl,
      status: 'pending',
      createdAt: Date.now(),
    };
    return data;
  });

  await userMessage.reply(
    '✅ ส่งคำขอยืนยันเรียบร้อย! แอดมินจะตรวจสอบและแจ้งผลให้ทราบ'
  );

  // ลบรูปต้นฉบับเพื่อความเป็นส่วนตัว (เก็บใน adminChannel แทน)
  setTimeout(() => userMessage.delete().catch(() => {}), 3000);
}

/**
 * แอดมินกดอนุมัติ → เปิด Modal ให้กรอกนามเรียกขาน
 */
export async function handleVerifyApprove(interaction) {
  if (!interaction.member.roles.cache.has(config.roles.admin)) {
    return interaction.reply({
      content: '❌ คุณไม่มีสิทธิ์ดำเนินการนี้',
      ephemeral: true,
    });
  }

  const targetUserId = interaction.customId.split(':')[1];

  const modal = new ModalBuilder()
    .setCustomId(`verify_callsign_modal:${targetUserId}:${interaction.message.id}`)
    .setTitle('กรอกนามเรียกขาน');

  const callsignInput = new TextInputBuilder()
    .setCustomId('callsign')
    .setLabel('นามเรียกขาน (Callsign)')
    .setPlaceholder('เช่น HS1ABC, E20XYZ')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(15);

  modal.addComponents(new ActionRowBuilder().addComponents(callsignInput));
  await interaction.showModal(modal);
}

/**
 * รับค่านามเรียกขานจาก Modal → ให้ยศ + เปลี่ยนชื่อใน server
 */
export async function handleCallsignSubmit(interaction) {
  const [, targetUserId, originalMsgId] = interaction.customId.split(':');
  const callsign = interaction.fields.getTextInputValue('callsign').toUpperCase().trim();

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const member = await guild.members.fetch(targetUserId).catch(() => null);

  if (!member) {
    return interaction.editReply('❌ ไม่พบผู้ใช้งาน อาจออกจากเซิร์ฟเวอร์ไปแล้ว');
  }

  try {
    // เพิ่มยศนักวิทยุสมัครเล่น
    if (config.roles.ham) await member.roles.add(config.roles.ham);
    // ลบยศบุคคลทั่วไป
    if (config.roles.general && member.roles.cache.has(config.roles.general)) {
      await member.roles.remove(config.roles.general);
    }

    // ตั้งชื่อ nickname เป็น "Callsign - ชื่อเดิม"
    const newNick = `${callsign} - ${member.user.username}`.substring(0, 32);
    await member.setNickname(newNick).catch(() => {});

    // บันทึกใน DB
    verifiedUsers.update((data) => {
      data[targetUserId] = {
        callsign,
        verifiedAt: Date.now(),
        verifiedBy: interaction.user.id,
      };
      return data;
    });

    verifications.update((data) => {
      if (data[originalMsgId]) data[originalMsgId].status = 'approved';
      return data;
    });

    // อัปเดตข้อความเดิม
    const originalMsg = await interaction.channel.messages.fetch(originalMsgId).catch(() => null);
    if (originalMsg) {
      const updatedEmbed = EmbedBuilder.from(originalMsg.embeds[0])
        .setColor('#27AE60')
        .setTitle('✅ อนุมัติแล้ว')
        .addFields(
          { name: 'นามเรียกขาน', value: callsign, inline: true },
          { name: 'อนุมัติโดย', value: `<@${interaction.user.id}>`, inline: true }
        );
      await originalMsg.edit({ embeds: [updatedEmbed], components: [] });
    }

    // แจ้งผู้ใช้
    await member
      .send(
        `🎉 ยินดีด้วย! การยืนยันตัวตนของคุณได้รับการอนุมัติแล้ว\n` +
          `📡 นามเรียกขาน: **${callsign}**\n` +
          `คุณได้รับยศ **นักวิทยุสมัครเล่น** เรียบร้อย`
      )
      .catch(() => {});

    await interaction.editReply(`✅ อนุมัติ <@${targetUserId}> ด้วย callsign \`${callsign}\` เรียบร้อย`);
  } catch (err) {
    console.error('Approve error:', err);
    await interaction.editReply(`❌ เกิดข้อผิดพลาด: ${err.message}`);
  }
}

/**
 * แอดมินกดปฏิเสธ
 */
export async function handleVerifyReject(interaction) {
  if (!interaction.member.roles.cache.has(config.roles.admin)) {
    return interaction.reply({
      content: '❌ คุณไม่มีสิทธิ์ดำเนินการนี้',
      ephemeral: true,
    });
  }

  const targetUserId = interaction.customId.split(':')[1];
  await interaction.deferReply({ ephemeral: true });

  verifications.update((data) => {
    if (data[interaction.message.id]) data[interaction.message.id].status = 'rejected';
    return data;
  });

  // อัปเดตข้อความ
  const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor('#95A5A6')
    .setTitle('❌ ปฏิเสธแล้ว')
    .addFields({ name: 'ปฏิเสธโดย', value: `<@${interaction.user.id}>`, inline: true });
  await interaction.message.edit({ embeds: [updatedEmbed], components: [] });

  // แจ้งผู้ใช้
  const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
  if (member) {
    await member
      .send(
        '❌ คำขอยืนยันตัวตนของคุณไม่ผ่านการตรวจสอบ\n' +
          'กรุณาส่งรูปบัตรที่ชัดเจนกว่านี้ หรือติดต่อแอดมินเพื่อสอบถาม'
      )
      .catch(() => {});
  }

  await interaction.editReply(`❌ ปฏิเสธคำขอของ <@${targetUserId}> เรียบร้อย`);
}