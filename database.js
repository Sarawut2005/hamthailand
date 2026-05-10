import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ระบบฐานข้อมูลแบบไฟล์ JSON ใช้งานง่าย ไม่ต้องตั้ง DB ภายนอก
class JsonStore {
  constructor(filename, defaultValue = {}) {
    this.path = path.join(DATA_DIR, filename);
    if (!fs.existsSync(this.path)) {
      fs.writeFileSync(this.path, JSON.stringify(defaultValue, null, 2));
    }
  }

  read() {
    try {
      return JSON.parse(fs.readFileSync(this.path, 'utf8'));
    } catch (err) {
      console.error('JsonStore read error:', err);
      return {};
    }
  }

  write(data) {
    fs.writeFileSync(this.path, JSON.stringify(data, null, 2));
  }

  update(fn) {
    const data = this.read();
    const result = fn(data);
    this.write(result ?? data);
  }
}

// เก็บข้อมูลคำขอยืนยันตัวตน { messageId: { userId, imageUrl, status } }
export const verifications = new JsonStore('verifications.json', {});

// เก็บข้อมูลผู้ใช้ที่ยืนยันแล้ว { userId: { callsign, verifiedAt, verifiedBy } }
export const verifiedUsers = new JsonStore('verifiedUsers.json', {});

// เก็บข้อมูล ticket { channelId: { userId, createdAt, topic } }
export const tickets = new JsonStore('tickets.json', {});

// เก็บ RSS items ที่เคยส่งแล้ว { guid: timestamp }
export const rssCache = new JsonStore('rssCache.json', { items: {} });
