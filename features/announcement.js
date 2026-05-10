import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { config } from '../config.js';

/**
 * ส่งประกาศไปยังห้องประกาศ
 * รองรับ: title, description, mention @everyone/@here, color
 */
export async function sendAnnouncement(interaction, options) {
  const { title, content, mention = 'none', color = '#1ABC9C', imageUrl = null } = options;

  const channel = await interaction.guild.channels
    .fetch(config.channels.announcement)
    .catch(() => null);

  if (!channel) {
    return interaction.editReply('❌ ไม่พบห้องประกาศ กรุณาตั้งค่า ANNOUNCEMENT_CHANNEL_ID');
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📢 ${title}`)
    .setDescription(content)
    .setFooter({
      text: `ประกาศโดย ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

  if (imageUrl) embed.setImage(imageUrl);

  let mentionText = '';
  if (mention === 'everyone') mentionText = '@everyone';
  else if (mention === 'here') mentionText = '@here';
  else if (mention === 'ham') mentionText = `<@&${config.roles.ham}>`;

  await channel.send({
    content: mentionText || undefined,
    embeds: [embed],
    allowedMentions: { parse: ['everyone'], roles: config.roles.ham ? [config.roles.ham] : [] },
  });

  await interaction.editReply(`✅ ส่งประกาศเรียบร้อยที่ <#${channel.id}>`);
}
