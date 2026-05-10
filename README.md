# 🎙️ HAMTHAILAND Discord Bot

Discord Bot สำหรับชุมชน [HAMTHAILAND.ORG](https://www.hamthailand.org) — ระบบยืนยันตัวตนนักวิทยุสมัครเล่น, Ticket, ประกาศ, RSS Feed, จัดการสมาชิก และยศประเทศ

## ✨ ฟีเจอร์

| ระบบ | รายละเอียด |
|------|-----------|
| 🔐 **ยืนยันตัวตน** | สมาชิกส่งรูปบัตรพนักงานวิทยุสมัครเล่น → แอดมินรีวิว + กรอกนามเรียกขาน → ได้ยศ "นักวิทยุสมัครเล่น" |
| 👤 **ยศบุคคลทั่วไป** | คนที่เพิ่งเข้ามาได้ยศนี้อัตโนมัติ |
| 🎫 **Ticket** | ระบบติดต่อแอดมินแบบส่วนตัว มี transcript log |
| 📢 **ประกาศ** | คำสั่ง `/announce` ส่งประกาศพร้อม mention |
| 📰 **RSS Feed** | ดึงข่าวจาก https://www.hamthailand.org/feed.php อัตโนมัติทุก 15 นาที |
| 🔨 **จัดการสมาชิก** | `/ban` `/kick` `/timeout` `/unban` `/untimeout` พร้อม log |
| 🌍 **ยศประเทศ** | สร้างยศประเทศอัตโนมัติตอนบอทเริ่มต้น + ให้สมาชิกเลือกเอง |

## 🚀 การติดตั้ง

### 1. สร้าง Bot Application

1. ไปที่ https://discord.com/developers/applications
2. กด **New Application** → ตั้งชื่อ `HAMTHAILAND Bot`
3. ไปที่แท็บ **Bot** → **Reset Token** → คัดลอก token เก็บไว้
4. เปิด **Privileged Gateway Intents** ทั้ง 3 ตัว:
   - ✅ Presence Intent
   - ✅ Server Members Intent
   - ✅ Message Content Intent
5. ไปที่แท็บ **OAuth2 → URL Generator**
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Administrator` (หรือเลือกเฉพาะที่ต้องการ)
6. คัดลอก URL → เปิดในเบราว์เซอร์ → เชิญบอทเข้า server

### 2. ติดตั้งโปรเจกต์

```bash
# ต้องมี Node.js v18 หรือใหม่กว่า
node --version

# Clone หรือคัดลอกไฟล์ทั้งหมด แล้ว:
cd hamthailand-bot
npm install
```

### 3. ตั้งค่า .env

```bash
cp .env.example .env
nano .env   # หรือเปิดด้วย editor อื่น
```

เปิด **Developer Mode** ใน Discord (Settings → Advanced) แล้วคลิกขวาที่ server/channel/role ต่าง ๆ เพื่อ Copy ID

ค่าที่ **จำเป็นต้องมี**:
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`

ค่าที่ **แนะนำให้ตั้งครบ** เพื่อใช้ทุกฟีเจอร์ได้:
- `VERIFICATION_CHANNEL_ID` - ห้องสำหรับยืนยันตัวตน
- `ADMIN_REVIEW_CHANNEL_ID` - ห้องที่แอดมินรีวิว (ควรซ่อนจากสมาชิกทั่วไป)
- `TICKET_CATEGORY_ID` - Category สำหรับ ticket
- `TICKET_LOG_CHANNEL_ID`
- `ANNOUNCEMENT_CHANNEL_ID`
- `RSS_CHANNEL_ID`
- `LOG_CHANNEL_ID`
- `HAM_ROLE_ID` - ยศนักวิทยุสมัครเล่น (สร้างใน server เอง)
- `GENERAL_ROLE_ID` - ยศบุคคลทั่วไป (สร้างใน server เอง)
- `ADMIN_ROLE_ID` - ยศแอดมิน (สร้างใน server เอง)

### 4. รันบอท

```bash
npm start
```

ตอนเริ่มต้น บอทจะ:
- Register slash commands ทั้งหมด
- **สร้างยศประเทศอัตโนมัติ** (25 ประเทศ — Thailand, Laos, Cambodia, Myanmar, Vietnam, Malaysia, etc.)
- เริ่ม RSS scheduler ตรวจทุก 15 นาที

### 5. ตั้งค่าใน Discord

หลังบอทออนไลน์ ใช้คำสั่งเหล่านี้ในห้องที่ต้องการ:

```
/setup-verify     # โพสต์ panel ยืนยันตัวตน (ในห้อง VERIFICATION_CHANNEL_ID)
/setup-ticket     # โพสต์ panel ticket
/setup-country    # โพสต์ panel เลือกประเทศ
```

## 📋 คำสั่งทั้งหมด

| คำสั่ง | คำอธิบาย | สิทธิ์ |
|--------|---------|------|
| `/help` | แสดงคำสั่งทั้งหมด | ทุกคน |
| `/whois [user]` | ดูข้อมูลนักวิทยุสมัครเล่น | ทุกคน |
| `/setup-verify` | โพสต์ panel ยืนยันตัวตน | Admin |
| `/setup-ticket` | โพสต์ panel ticket | Admin |
| `/setup-country` | โพสต์ panel เลือกประเทศ | Admin |
| `/setup-country-roles` | สร้างยศประเทศใหม่ | Admin |
| `/announce <title> <content>` | ส่งประกาศ | Manage Messages |
| `/ban <user> <reason>` | แบนสมาชิก | Ban Members |
| `/unban <user_id>` | ปลดแบน | Ban Members |
| `/kick <user> <reason>` | เตะสมาชิก | Kick Members |
| `/timeout <user> <minutes> <reason>` | Timeout | Moderate Members |
| `/untimeout <user>` | ปลด timeout | Moderate Members |
| `/rss-check` | สั่งตรวจ RSS ทันที | Admin |

## 🔄 การทำงานของระบบยืนยันตัวตน

```
สมาชิกเข้าเซิร์ฟเวอร์
    ↓
ได้ยศ "บุคคลทั่วไป" อัตโนมัติ + DM แนะนำ
    ↓
ไปห้อง verification → กดปุ่ม "📷 ส่งบัตรเพื่อยืนยัน"
    ↓
ส่งรูปบัตรในห้อง (ภายใน 5 นาที)
    ↓
รูปถูกส่งไปห้องแอดมินรีวิว + ลบจากห้องสาธารณะ
    ↓
แอดมินกด "✅ อนุมัติ" → เปิด Modal ใส่ Callsign
    ↓
สมาชิกได้ยศ "นักวิทยุสมัครเล่น" + ตั้ง nickname เป็น "HS1ABC - Username"
    ↓
DM แจ้งสมาชิก
```

## 🌍 ยศประเทศที่สร้างให้อัตโนมัติ

🇹🇭 Thailand • 🇱🇦 Laos • 🇰🇭 Cambodia • 🇲🇲 Myanmar • 🇻🇳 Vietnam • 🇲🇾 Malaysia • 🇸🇬 Singapore • 🇮🇩 Indonesia • 🇵🇭 Philippines • 🇯🇵 Japan • 🇰🇷 South Korea • 🇨🇳 China • 🇹🇼 Taiwan • 🇭🇰 Hong Kong • 🇮🇳 India • 🇦🇺 Australia • 🇳🇿 New Zealand • 🇺🇸 United States • 🇨🇦 Canada • 🇬🇧 United Kingdom • 🇩🇪 Germany • 🇫🇷 France • 🇷🇺 Russia • 🇧🇷 Brazil • 🌍 Other

แก้ไขรายชื่อได้ใน `config.js` → `countries[]`

## 💾 ข้อมูล

บอทเก็บข้อมูลในไฟล์ JSON ที่โฟลเดอร์ `data/`:
- `verifiedUsers.json` - ผู้ใช้ที่ยืนยันแล้ว + นามเรียกขาน
- `verifications.json` - คำขอยืนยันที่ค้างอยู่
- `tickets.json` - ข้อมูล ticket
- `rssCache.json` - GUID ของ RSS ที่ส่งแล้ว (กันสแปม)

> 💡 ถ้าต้องการสเกลใหญ่ขึ้น แนะนำเปลี่ยนเป็น SQLite/PostgreSQL ภายหลัง

## 🐳 รันด้วย Docker (ทางเลือก)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["node", "index.js"]
```

```bash
docker build -t hamthailand-bot .
docker run -d --env-file .env -v $(pwd)/data:/app/data hamthailand-bot
```

## 📝 License

MIT — ใช้งาน, แก้ไข, แจกจ่ายได้อย่างอิสระ

---

73 de HAMTHAILAND.ORG 📡
