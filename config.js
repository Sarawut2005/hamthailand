import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  channels: {
    verification: process.env.VERIFICATION_CHANNEL_ID,
    adminReview: process.env.ADMIN_REVIEW_CHANNEL_ID,
    ticketCategory: process.env.TICKET_CATEGORY_ID,
    ticketLog: process.env.TICKET_LOG_CHANNEL_ID,
    announcement: process.env.ANNOUNCEMENT_CHANNEL_ID,
    rss: process.env.RSS_CHANNEL_ID,
    log: process.env.LOG_CHANNEL_ID,
  },

  roles: {
    ham: process.env.HAM_ROLE_ID,
    general: process.env.GENERAL_ROLE_ID,
    admin: process.env.ADMIN_ROLE_ID,
  },

  rss: {
    url: process.env.RSS_FEED_URL || 'https://www.hamthailand.org/feed.php',
    cron: process.env.RSS_CHECK_CRON || '*/15 * * * *',
  },

  // ข้อมูลรายชื่อประเทศ ISO + ธง emoji (สำหรับสร้างยศประเทศ)
  // เลือกประเทศหลัก ๆ ที่นิยมในวงการวิทยุสมัครเล่น
  countries: [
    { name: 'Thailand', flag: '🇹🇭', color: '#ED1C24' },
    { name: 'Laos', flag: '🇱🇦', color: '#CE1126' },
    { name: 'Cambodia', flag: '🇰🇭', color: '#032EA1' },
    { name: 'Myanmar', flag: '🇲🇲', color: '#FECB00' },
    { name: 'Vietnam', flag: '🇻🇳', color: '#DA251D' },
    { name: 'Malaysia', flag: '🇲🇾', color: '#010066' },
    { name: 'Singapore', flag: '🇸🇬', color: '#EF3340' },
    { name: 'Indonesia', flag: '🇮🇩', color: '#FF0000' },
    { name: 'Philippines', flag: '🇵🇭', color: '#0038A8' },
    { name: 'Japan', flag: '🇯🇵', color: '#BC002D' },
    { name: 'South Korea', flag: '🇰🇷', color: '#003478' },
    { name: 'China', flag: '🇨🇳', color: '#DE2910' },
    { name: 'Taiwan', flag: '🇹🇼', color: '#FE0000' },
    { name: 'Hong Kong', flag: '🇭🇰', color: '#DE2408' },
    { name: 'India', flag: '🇮🇳', color: '#FF9933' },
    { name: 'Australia', flag: '🇦🇺', color: '#012169' },
    { name: 'New Zealand', flag: '🇳🇿', color: '#012169' },
    { name: 'United States', flag: '🇺🇸', color: '#3C3B6E' },
    { name: 'Canada', flag: '🇨🇦', color: '#FF0000' },
    { name: 'United Kingdom', flag: '🇬🇧', color: '#012169' },
    { name: 'Germany', flag: '🇩🇪', color: '#000000' },
    { name: 'France', flag: '🇫🇷', color: '#0055A4' },
    { name: 'Russia', flag: '🇷🇺', color: '#0033A0' },
    { name: 'Brazil', flag: '🇧🇷', color: '#009C3B' },
    { name: 'Other', flag: '🌍', color: '#95A5A6' },
  ],
};

// ตรวจสอบว่ามีค่าครบ
export function validateConfig() {
  const required = ['token', 'clientId', 'guildId'];
  const missing = required.filter((k) => !config[k]);
  if (missing.length > 0) {
    console.error('❌ Missing required env vars:', missing.join(', '));
    process.exit(1);
  }
}
