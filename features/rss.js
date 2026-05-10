import Parser from 'rss-parser';
import cron from 'node-cron';
import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { rssCache } from '../database.js';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'HamThailand-Discord-Bot/1.0',
  },
  customFields: {
    item: [
      ['dc:creator', 'creator'],
      ['content:encoded', 'contentEncoded'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
    ],
  },
});

// แมปสีและไอคอน emoji ตาม category
const CATEGORY_STYLE = {
  'ความรู้ทั่วไป': { color: '#3498DB', emoji: '📚', label: 'ความรู้ทั่วไป' },
  'ประวัติสถานีควบคุมข่าย': { color: '#9B59B6', emoji: '🏛️', label: 'ประวัติสถานีควบคุมข่าย' },
  'ข่าวสาร': { color: '#E74C3C', emoji: '📰', label: 'ข่าวสาร' },
  'กิจกรรม': { color: '#F39C12', emoji: '🎉', label: 'กิจกรรม' },
  'เทคนิค': { color: '#1ABC9C', emoji: '🔧', label: 'เทคนิค' },
  'อุปกรณ์': { color: '#16A085', emoji: '📻', label: 'อุปกรณ์' },
  'การสอบ': { color: '#27AE60', emoji: '📝', label: 'การสอบ' },
  'กฎระเบียบ': { color: '#C0392B', emoji: '⚖️', label: 'กฎระเบียบ' },
  default: { color: '#E67E22', emoji: '📡', label: 'บทความ' },
};

function getCategoryStyle(category) {
  if (!category) return CATEGORY_STYLE.default;
  return CATEGORY_STYLE[category] || CATEGORY_STYLE.default;
}

// ฟอร์แมตวันที่เป็นภาษาไทย พ.ศ.
function formatThaiDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];

  const day = d.getDate();
  const month = thaiMonths[d.getMonth()];
  const year = d.getFullYear() + 543; // พ.ศ.
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year} เวลา ${hour}:${min} น.`;
}

// ทำความสะอาด HTML และ extract text + image
function cleanContent(html) {
  if (!html) return { text: '', imageUrl: null };

  const str = String(html);

  // ดึงรูปแรกจาก <img>
  const imgMatch = str.match(/<img[^>]+src=["']([^"']+)["']/i);
  const imageUrl = imgMatch ? imgMatch[1] : null;

  // ลบ HTML tags ทุกอย่าง
  let text = str.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities ที่พบบ่อย
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // ตัด "อ่านต่อบนเว็บไซต์ →" ออกจากท้ายข้อความ
  text = text.replace(/อ่านต่อบนเว็บไซต์\s*→?\s*$/i, '').trim();

  // ลด newline ติดกันให้เหลือแค่ 1
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return { text, imageUrl };
}

/**
 * สร้าง embed สวยงามจาก RSS item
 */
function buildRssEmbed(item, feed) {
  const category = item.categories?.[0] || item.category;
  const style = getCategoryStyle(category);

  const { text: cleanedDesc, imageUrl: descImage } = cleanContent(
    item.contentEncoded || item.content || item.description || item.contentSnippet
  );

  // ตัดความยาว description
  let description = cleanedDesc;
  if (description.length > 400) {
    description = description.substring(0, 400).trim() + '...';
  }

  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setAuthor({
      name: feed.title || 'HAMTHAILAND.ORG',
      iconURL: 'https://www.hamthailand.org/favicon.ico',
      url: feed.link || 'https://www.hamthailand.org',
    })
    .setTitle(`${style.emoji} ${item.title || 'ไม่มีหัวข้อ'}`)
    .setURL(item.link)
    .setFooter({
      text: 'hamthailand.org • บทความใหม่',
      iconURL: 'https://www.hamthailand.org/favicon.ico',
    });

  if (description) {
    embed.setDescription(`>>> ${description}`);
  }

  // ฟิลด์ข้อมูลเสริม
  const fields = [];

  if (category) {
    fields.push({
      name: '📂 หมวดหมู่',
      value: `\`${style.label}\``,
      inline: true,
    });
  }

  const author = item.creator || item.author || item['dc:creator'];
  if (author) {
    fields.push({
      name: '✍️ ผู้เขียน',
      value: author,
      inline: true,
    });
  }

  if (item.pubDate) {
    const thaiDate = formatThaiDate(item.pubDate);
    if (thaiDate) {
      fields.push({
        name: '🗓️ เผยแพร่',
        value: thaiDate,
        inline: false,
      });
    }
  }

  if (fields.length > 0) embed.addFields(fields);

  // ใส่ link เป็น field สุดท้ายแบบเด่น
  embed.addFields({
    name: '\u200b',
    value: `🔗 **[อ่านบทความเต็ม →](${item.link})**`,
    inline: false,
  });

  // รูปประกอบ
  const imageUrl =
    descImage ||
    item.enclosure?.url ||
    item.mediaThumbnail?.$?.url ||
    item.mediaContent?.$?.url;

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  if (item.pubDate) {
    embed.setTimestamp(new Date(item.pubDate));
  }

  return embed;
}

/**
 * ตรวจ RSS feed และส่งโพสต์ใหม่ไป Discord
 */
export async function checkRssFeed(client, options = {}) {
  const { force = false, silent = false } = options;

  try {
    if (!silent) console.log(`[RSS] กำลังตรวจ feed: ${config.rss.url}`);
    const feed = await parser.parseURL(config.rss.url);

    const channel = await client.channels.fetch(config.channels.rss).catch(() => null);
    if (!channel) {
      console.warn('[RSS] ไม่พบห้อง RSS — ตรวจสอบ RSS_CHANNEL_ID');
      return { ok: false, reason: 'no_channel' };
    }

    const cache = rssCache.read();
    cache.items = cache.items || {};

    // ครั้งแรก: ใส่ทั้งหมดใน cache โดยไม่ส่ง (กันสแปม)
    if (!force && Object.keys(cache.items).length === 0) {
      for (const item of feed.items) {
        const id = item.guid || item.link;
        cache.items[id] = Date.now();
      }
      rssCache.write(cache);
      if (!silent) console.log(`[RSS] บันทึก ${feed.items.length} รายการเริ่มต้นใน cache`);
      return { ok: true, sent: 0, initialized: feed.items.length };
    }

    // หาโพสต์ใหม่ (เรียงจากเก่าไปใหม่ เพื่อให้โพสต์ตามลำดับเวลา)
    const newItems = feed.items
      .filter((item) => !cache.items[item.guid || item.link])
      .reverse();

    if (newItems.length === 0) {
      if (!silent) console.log('[RSS] ไม่มีโพสต์ใหม่');
      return { ok: true, sent: 0 };
    }

    if (!silent) console.log(`[RSS] พบโพสต์ใหม่ ${newItems.length} รายการ`);

    let sent = 0;
    for (const item of newItems) {
      const embed = buildRssEmbed(item, feed);
      try {
        await channel.send({ embeds: [embed] });
        cache.items[item.guid || item.link] = Date.now();
        sent++;
      } catch (err) {
        console.error('[RSS] ส่งข้อความล้มเหลว:', err.message);
      }
      // หน่วงระหว่างโพสต์ กัน rate limit
      await new Promise((r) => setTimeout(r, 1500));
    }

    // ทำความสะอาด cache เก่ากว่า 30 วัน
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const [id, ts] of Object.entries(cache.items)) {
      if (ts < cutoff) delete cache.items[id];
    }

    rssCache.write(cache);
    return { ok: true, sent };
  } catch (err) {
    console.error('[RSS] error:', err.message);
    return { ok: false, reason: 'error', error: err.message };
  }
}

/**
 * ทดสอบ — โพสต์ข่าวล่าสุด N รายการ ลงห้อง RSS โดยไม่สนใจ cache
 */
export async function postLatestRss(client, count = 1) {
  try {
    const feed = await parser.parseURL(config.rss.url);

    const channel = await client.channels.fetch(config.channels.rss).catch(() => null);
    if (!channel) {
      return { ok: false, reason: 'no_channel' };
    }

    if (!feed.items || feed.items.length === 0) {
      return { ok: false, reason: 'empty_feed' };
    }

    const items = feed.items.slice(0, Math.min(count, feed.items.length));
    let sent = 0;

    // โพสต์เรียงจากเก่าไปใหม่ (รายการล่าสุดจะอยู่ล่างสุด ใน Discord)
    for (const item of items.reverse()) {
      const embed = buildRssEmbed(item, feed);
      try {
        await channel.send({ embeds: [embed] });
        sent++;
      } catch (err) {
        console.error('[RSS Test] ส่งข้อความล้มเหลว:', err.message);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    return { ok: true, sent, total: feed.items.length };
  } catch (err) {
    console.error('[RSS Test] error:', err);
    return { ok: false, reason: 'error', error: err.message };
  }
}

/**
 * Preview — ดูข่าวล่าสุดเป็น ephemeral (เห็นเฉพาะคนสั่ง) ก่อนตัดสินใจโพสต์
 */
export async function previewLatestRss(count = 3) {
  try {
    const feed = await parser.parseURL(config.rss.url);
    if (!feed.items || feed.items.length === 0) {
      return { ok: false, reason: 'empty_feed' };
    }
    const items = feed.items.slice(0, Math.min(count, feed.items.length));
    const embeds = items.map((item) => buildRssEmbed(item, feed));
    return { ok: true, embeds, total: feed.items.length };
  } catch (err) {
    return { ok: false, reason: 'error', error: err.message };
  }
}

/**
 * Reset cache — สำหรับ admin ที่อยากให้ส่งซ้ำตั้งแต่แรก
 */
export function resetRssCache() {
  rssCache.write({ items: {} });
}

/**
 * เริ่ม cron job ตรวจ RSS อัตโนมัติ
 */
export function startRssScheduler(client) {
  // ตรวจครั้งแรกตอนบอทเริ่ม (รอ 10 วินาที)
  setTimeout(() => checkRssFeed(client), 10000);

  // ตั้ง cron
  cron.schedule(config.rss.cron, () => checkRssFeed(client));
  console.log(`[RSS] ตั้ง schedule: ${config.rss.cron}`);
}