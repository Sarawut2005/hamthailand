import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../config.js';

async function logAction(guild, embed) {
  const logChannel = await guild.channels.fetch(config.channels.log).catch(() => null);
  if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => {});
}

/**
 * แบนสมาชิก
 */
export async function banMember(interaction, target, reason, deleteDays = 0) {
  const member = await interaction.guild.members.fetch(target.id).catch(() => null);

  // ตรวจสิทธิ์
  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.editReply('❌ คุณไม่มีสิทธิ์แบนสมาชิก');
  }

  if (member && !member.bannable) {
    return interaction.editReply('❌ ไม่สามารถแบนสมาชิกคนนี้ได้ (อาจมียศสูงกว่าบอท)');
  }

  try {
    // DM แจ้งเตือนก่อนแบน
    if (member) {
      await member
        .send(
          `🔨 คุณถูกแบนจากเซิร์ฟเวอร์ **${interaction.guild.name}**\n` +
            `เหตุผล: ${reason}`
        )
        .catch(() => {});
    }

    await interaction.guild.bans.create(target.id, {
      reason: `${reason} (โดย ${interaction.user.tag})`,
      deleteMessageSeconds: deleteDays * 24 * 60 * 60,
    });

    const embed = new EmbedBuilder()
      .setColor('#C0392B')
      .setTitle('🔨 สมาชิกถูกแบน')
      .addFields(
        { name: 'สมาชิก', value: `<@${target.id}> (\`${target.tag}\`)`, inline: false },
        { name: 'เหตุผล', value: reason || 'ไม่ระบุ', inline: false },
        { name: 'แบนโดย', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    await logAction(interaction.guild, embed);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`❌ แบนไม่สำเร็จ: ${err.message}`);
  }
}

/**
 * เตะสมาชิก
 */
export async function kickMember(interaction, target, reason) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.editReply('❌ คุณไม่มีสิทธิ์เตะสมาชิก');
  }

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.editReply('❌ ไม่พบสมาชิก');
  if (!member.kickable) return interaction.editReply('❌ ไม่สามารถเตะสมาชิกคนนี้ได้');

  try {
    await member
      .send(`👢 คุณถูกเตะจาก **${interaction.guild.name}**\nเหตุผล: ${reason}`)
      .catch(() => {});

    await member.kick(`${reason} (โดย ${interaction.user.tag})`);

    const embed = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('👢 สมาชิกถูกเตะ')
      .addFields(
        { name: 'สมาชิก', value: `<@${target.id}> (\`${target.tag}\`)`, inline: false },
        { name: 'เหตุผล', value: reason || 'ไม่ระบุ', inline: false },
        { name: 'เตะโดย', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    await logAction(interaction.guild, embed);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`❌ เตะไม่สำเร็จ: ${err.message}`);
  }
}

/**
 * Timeout (mute ชั่วคราว)
 * @param duration นาที
 */
export async function timeoutMember(interaction, target, duration, reason) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ คุณไม่มีสิทธิ์ timeout สมาชิก');
  }

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.editReply('❌ ไม่พบสมาชิก');
  if (!member.moderatable) return interaction.editReply('❌ ไม่สามารถ timeout สมาชิกคนนี้ได้');

  // Discord จำกัด timeout สูงสุด 28 วัน = 40320 นาที
  const ms = Math.min(duration * 60 * 1000, 28 * 24 * 60 * 60 * 1000);

  try {
    await member.timeout(ms, `${reason} (โดย ${interaction.user.tag})`);

    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🔇 สมาชิกถูก Timeout')
      .addFields(
        { name: 'สมาชิก', value: `<@${target.id}> (\`${target.tag}\`)`, inline: false },
        { name: 'ระยะเวลา', value: `${duration} นาที`, inline: true },
        { name: 'เหตุผล', value: reason || 'ไม่ระบุ', inline: false },
        { name: 'โดย', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    await logAction(interaction.guild, embed);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`❌ Timeout ไม่สำเร็จ: ${err.message}`);
  }
}

/**
 * ปลด Timeout
 */
export async function untimeoutMember(interaction, target) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.editReply('❌ คุณไม่มีสิทธิ์');
  }

  const member = await interaction.guild.members.fetch(target.id).catch(() => null);
  if (!member) return interaction.editReply('❌ ไม่พบสมาชิก');

  try {
    await member.timeout(null, `ปลด timeout โดย ${interaction.user.tag}`);
    await interaction.editReply(`✅ ปลด timeout <@${target.id}> เรียบร้อย`);
  } catch (err) {
    await interaction.editReply(`❌ ปลด timeout ไม่สำเร็จ: ${err.message}`);
  }
}

/**
 * ปลดแบน
 */
export async function unbanMember(interaction, userId, reason) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return interaction.editReply('❌ คุณไม่มีสิทธิ์');
  }

  try {
    await interaction.guild.bans.remove(userId, `${reason} (โดย ${interaction.user.tag})`);

    const embed = new EmbedBuilder()
      .setColor('#27AE60')
      .setTitle('🔓 ปลดแบน')
      .addFields(
        { name: 'User ID', value: userId, inline: true },
        { name: 'เหตุผล', value: reason || 'ไม่ระบุ', inline: false },
        { name: 'โดย', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    await logAction(interaction.guild, embed);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply(`❌ ปลดแบนไม่สำเร็จ: ${err.message}`);
  }
}
