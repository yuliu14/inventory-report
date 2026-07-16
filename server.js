// 库存预警系统 - 后端服务（Railway 部署版）
// 部署: 放到 GitHub 仓库，Railway 自动检测 Node.js 并部署

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// CORS — 允许 GitHub Pages 前端跨域访问
app.use(function(req, res, next){
  res.header('Access-Control-Allow-Origin','*');
  res.header('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.sendStatus(200);
  next();
});

// 中间件
app.use(express.json({ limit: '50mb' }));

// 读取数据文件
function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('读取数据文件失败:', e.message);
  }
  return {};
}

// 写入数据文件（原子写入：先写临时文件再重命名）
function writeData(data) {
  const tmp = DATA_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
    return true;
  } catch (e) {
    console.error('写入数据文件失败:', e.message);
    return false;
  }
}

// ==================== API 路由 ====================

// 获取所有数据（管理员同步用）
app.get('/api/state', (req, res) => {
  res.json(readData());
});

// 获取单个 key 的数据
app.get('/api/data/:key', (req, res) => {
  const data = readData();
  const val = data[req.params.key];
  res.json(val !== undefined ? val : null);
});

// 保存单个 key 的数据
app.post('/api/data/:key', (req, res) => {
  const data = readData();
  data[req.params.key] = req.body;
  if (writeData(data)) {
    console.log(`[${new Date().toLocaleTimeString()}] 保存 ${req.params.key} (${JSON.stringify(req.body).length} 字节)`);
    res.json({ ok: true });
  } else {
    res.status(500).json({ ok: false, error: '写入失败' });
  }
});

// 批量保存（原子操作）
app.post('/api/batch', (req, res) => {
  const data = readData();
  const batch = req.body; // { key1: value1, key2: value2, ... }
  for (const key in batch) {
    data[key] = batch[key];
  }
  if (writeData(data)) {
    const keys = Object.keys(batch).join(', ');
    console.log(`[${new Date().toLocaleTimeString()}] 批量保存: ${keys}`);
    res.json({ ok: true });
  } else {
    res.status(500).json({ ok: false, error: '写入失败' });
  }
});

// 获取历史版本列表
app.get('/api/backups', (req, res) => {
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter(f => f.startsWith('data.') && f.endsWith('.json') && !f.includes('.tmp'));
  res.json(files);
});

// ==================== 启动 ====================
app.listen(PORT, () => {
  console.log('');
  console.log('  📊 库存预警系统服务端已启动');
  console.log('  ─────────────────────────────');
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  数据: ${DATA_FILE}`);
  console.log('');
  console.log('  按 Ctrl+C 停止服务');
  console.log('');

  // 首次启动时初始化空数据
  if (!fs.existsSync(DATA_FILE)) {
    writeData({});
    console.log('  ✅ 已创建空数据文件');
  } else {
    const data = readData();
    const skuCount = (data.skuData || []).length;
    const orderCount = (data.replenOrders || []).length;
    console.log(`  📦 已有数据: ${skuCount} 条SKU, ${orderCount} 条补货单`);
  }
});
