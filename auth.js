import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Chỉ hỗ trợ phương thức POST' });
  }

  const { action, phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đủ SĐT và mật khẩu' });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('web_cua_toi');
    const users = db.collection('users');

    if (action === 'register') {
      const existingUser = await users.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({ message: 'Số điện thoại này đã được đăng ký!' });
      }
      await users.insertOne({ phone, password, createdAt: new Date() });
      return res.status(200).json({ message: 'Đăng ký thành công!' });
    }

    if (action === 'login') {
      const user = await users.findOne({ phone, password });
      if (!user) {
        return res.status(401).json({ message: 'Sai số điện thoại hoặc mật khẩu!' });
      }
      return res.status(200).json({ message: 'Đăng nhập thành công!', phone: user.phone });
    }

    return res.status(400).json({ message: 'Hành động không hợp lệ' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi kết nối database', error: error.message });
  }
}