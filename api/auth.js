import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = 'web_cua_toi';
let cachedClient = globalThis._mongoClient ?? null;

async function connectToDatabase() {
  if (!uri) {
    throw new Error('Thiếu biến môi trường MONGODB_URI trong file .env');
  }

  if (cachedClient) {
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch {
      cachedClient = null;
      globalThis._mongoClient = null;
    }
  }

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  await client.connect();
  cachedClient = client;
  globalThis._mongoClient = client;
  return client;
}

export async function authHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Chỉ hỗ trợ phương thức POST' });
  }

  const { action, phone, password } = req.body || {};
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';

  if (!cleanPhone || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đủ SĐT và mật khẩu' });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db(dbName);
    const users = db.collection('users');

    if (action === 'register') {
      const existingUser = await users.findOne({ phone: cleanPhone });
      if (existingUser) {
        return res.status(400).json({ message: 'Số điện thoại này đã được đăng ký!' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await users.insertOne({
        phone: cleanPhone,
        password: hashedPassword,
        createdAt: new Date(),
      });

      return res.status(200).json({ message: 'Đăng ký thành công!' });
    }

    if (action === 'login') {
      const user = await users.findOne({ phone: cleanPhone });
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Sai số điện thoại hoặc mật khẩu!' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Sai số điện thoại hoặc mật khẩu!' });
      }

      return res.status(200).json({
        message: 'Đăng nhập thành công!',
        phone: user.phone,
      });
    }

    return res.status(400).json({ message: 'Hành động không hợp lệ' });
  } catch (error) {
    console.error('API Auth Error:', error);
    cachedClient = null;
    globalThis._mongoClient = null;

    return res.status(500).json({
      message: 'Lỗi kết nối database',
      error: error.message,
    });
  }
}

export async function submissionsHandler(req, res) {
  try {
    const client = await connectToDatabase();
    const db = client.db(dbName);
    const submissions = db.collection('submissions');

    if (req.method === 'POST') {
      const { name, contact, message } = req.body || {};
      const cleanName = typeof name === 'string' ? name.trim() : '';
      const cleanContact = typeof contact === 'string' ? contact.trim() : '';
      const cleanMessage = typeof message === 'string' ? message.trim() : '';

      if (!cleanName && !cleanContact && !cleanMessage) {
        return res.status(400).json({ message: 'Vui lòng nhập ít nhất một thông tin!' });
      }

      await submissions.insertOne({
        name: cleanName,
        contact: cleanContact,
        message: cleanMessage,
        createdAt: new Date(),
      });

      return res.status(200).json({ message: 'Đã gửi thông tin thành công!' });
    }

    if (req.method === 'GET') {
      const items = await submissions
        .find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      return res.status(200).json({ items });
    }

    return res.status(405).json({ message: 'Phương thức không được hỗ trợ' });
  } catch (error) {
    console.error('API Submissions Error:', error);
    cachedClient = null;
    globalThis._mongoClient = null;

    return res.status(500).json({
      message: 'Lỗi xử lý dữ liệu',
      error: error.message,
    });
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(__dirname, '..');

  app.use(express.json());
  app.use(express.static(rootDir));

  app.all('/api/auth', async (req, res) => {
    await authHandler(req, res);
  });

  app.all('/api/submissions', async (req, res) => {
    await submissionsHandler(req, res);
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}

export default authHandler;