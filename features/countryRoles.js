import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config.js';

const COUNTRY_ROLE_PREFIX = '🌍 ';

/**
 * สร้างยศประเทศทั้งหมดตาม config.countries
 * เรียกตอนบอทเริ่มต้น (idempotent - สร้างเฉพาะที่ยังไม่มี)
 */
export async function ensureCountryRoles(guild) {
  console.log('[Country Roles] กำลังตรวจสอบยศประเทศ...');
  let created = 0;
  let existing = 0;

  for (const country of config.countries) {
    const roleName = `${COUNTRY_ROLE_PREFIX}${country.flag} ${country.name}`;
    const role = guild.roles.cache.find((r) => r.name === roleName);

    if (role) {
      existing++;
      continue;
    }

    try {
      await guild.roles.create({
        name: roleName,
        color: country.color,
        mentionable: false,
        hoist: false,
        reason: 'สร้างยศประเทศโดยอัตโนมัติ - HAMTHAILAND Bot',
      });
      created++;
      console.log(`  ✅ สร้างยศ: ${roleName}`);
      // หน่วงกัน rate limit
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`  ❌ สร้าง ${roleName} ล้มเหลว:`, err.message);
    }
  }

  console.log(`[Country Roles] เสร็จสิ้น - สร้างใหม่ ${created}, มีอยู่แล้ว ${existing}`);
}

/**
 * โพสต์ panel ให้สมาชิกเลือกประเทศ
 */
export async function postCountryPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor('#16A085')
    .setTitle('🌍 เลือกประเทศของคุณ')
    .setDescription(
      'เลือกประเทศที่คุณอาศัยอยู่หรือถือครองนามเรียกขาน เพื่อรับยศประเทศ\n\n' +
        'หากต้องการเปลี่ยน เลือกใหม่ได้ทุกเมื่อ\n' +
        'หากประเทศของคุณไม่อยู่ในรายการ เลือก **🌍 Other**'
    );

  // Discord select menu จำกัด 25 options ต่อ menu
  const chunks = [];
  for (let i = 0; i < config.countries.length; i += 25) {
    chunks.push(config.countries.slice(i, i + 25));
  }

  const components = chunks.map((chunk, idx) => {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`country_select:${idx}`)
      .setPlaceholder(`เลือกประเทศ${chunks.length > 1 ? ` (กลุ่มที่ ${idx + 1})` : ''}...`)
      .addOptions(
        chunk.map((c) => ({
          label: c.name,
          value: c.name,
          emoji: c.flag,
        }))
      );
    return new ActionRowBuilder().addComponents(select);
  });

  await channel.send({ embeds: [embed], components });
}

/**
 * จัดการเมื่อสมาชิกเลือกประเทศ
 */
export async function handleCountrySelect(interaction) {
  const countryName = interaction.values[0];
  const country = config.countries.find((c) => c.name === countryName);
  if (!country) {
    return interaction.reply({ content: '❌ ไม่พบประเทศ', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  const member = interaction.member;

  const targetRoleName = `${COUNTRY_ROLE_PREFIX}${country.flag} ${country.name}`;
  const targetRole = guild.roles.cache.find((r) => r.name === targetRoleName);

  if (!targetRole) {
    return interaction.editReply(
      `❌ ยังไม่มียศ ${countryName} ในเซิร์ฟเวอร์ กรุณาแจ้งแอดมินรัน /setup-country-roles`
    );
  }

  try {
    // ลบยศประเทศเก่าทั้งหมด
    const oldCountryRoles = member.roles.cache.filter((r) =>
      r.name.startsWith(COUNTRY_ROLE_PREFIX)
    );
    for (const [, role] of oldCountryRoles) {
      if (role.id !== targetRole.id) {
        await member.roles.remove(role).catch(() => {});
      }
    }

    // เพิ่มยศใหม่
    if (!member.roles.cache.has(targetRole.id)) {
      await member.roles.add(targetRole);
    }

    await interaction.editReply(
      `✅ ตั้งยศประเทศเป็น ${country.flag} **${country.name}** เรียบร้อย`
    );
  } catch (err) {
    console.error('Country select error:', err);
    await interaction.editReply(`❌ เกิดข้อผิดพลาด: ${err.message}`);
  }
}
