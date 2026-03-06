import Koa from 'koa';
import { koaBody } from 'koa-body';
import cors from 'koa-cors';
import serve from 'koa-static';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { connectDB } from './config/database.js';
import feedbackRouter from './routes/feedback.js';
import adminRouter from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Koa();

const PORT = process.env.PORT || 3000;

const allowedOrigins = new Set([
  'https://feedback.yvzl.top/',
  'https://admin.yvzl.top/',
  'http://localhost:3001/',
  'http://localhost:3002/'
]);

app.use(cors({
  origin: (ctx) => {
    const origin = ctx.get('Origin');
    if (allowedOrigins.has(origin)) {
      return origin;
    }
    return false;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
}));

app.use(koaBody({
  multipart: true,
  formidable: {
    maxFileSize: 10 * 1024 * 1024,
    uploadDir: path.join(__dirname, '../uploads')
  }
}));

// 静态文件服务
const uploadsPath = path.resolve(__dirname, '../uploads');

// 手动处理 /uploads 路由
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/uploads/')) {
    const filePath = path.join(uploadsPath, path.basename(ctx.path));
    
    const fs = await import('fs');
    if (fs.existsSync(filePath)) {
      ctx.set('Content-Type', 'application/octet-stream');
      ctx.body = fs.createReadStream(filePath);
      return;
    }
    ctx.status = 404;
    ctx.body = 'File not found';
    return;
  }
  await next();
});

// Token 验证中间件 - 用于管理端接口
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/admin') && ctx.path !== '/api/admin/login') {
    const authHeader = ctx.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        message: '未授权访问，请先登录'
      };
      return;
    }

    // token 格式：adminId-username-timestamp
    const tokenParts = token.split('-');
    if (tokenParts.length >= 1 && tokenParts[0].length === 24) {
      ctx.state.adminId = tokenParts[0];
    } else {
      ctx.status = 401;
      ctx.body = {
        success: false,
        message: '无效的 token'
      };
      return;
    }
  }
  await next();
});

app.use(feedbackRouter.routes());
app.use(feedbackRouter.allowedMethods());

app.use(adminRouter.routes());
app.use(adminRouter.allowedMethods());

app.use(async (ctx, next) => {
  if (ctx.path === '/') {
    ctx.body = {
      message: '施工反馈 API 服务运行中',
      version: '1.0.0',
      endpoints: {
        feedback: {
          submit: 'POST /api/feedback/submit',
          list: 'GET /api/feedback/list',
          detail: 'GET /api/feedback/:id',
          update: 'PUT /api/feedback/:id',
          upload: 'POST /api/feedback/upload'
        },
        admin: {
          login: 'POST /api/admin/login',
          info: 'GET /api/admin/info',
          update: 'PUT /api/admin/info',
          list: 'GET /api/admin/list'
        }
      }
    };
  } else {
    await next();
  }
});

async function start() {
  await connectDB();
  
  await initializeAdmin();
  
  app.listen(PORT, () => {
    console.log(`API 服务运行在 http://localhost:${PORT}`);
  });
}

async function initializeAdmin() {
  const Admin = (await import('./models/Admin.js')).default;
  
  const existingAdmin = await Admin.findOne({ username: process.env.ADMIN_USERNAME || 'admin' });
  
  if (!existingAdmin) {
    const admin = new Admin({
      username: process.env.ADMIN_USERNAME || 'admin',
      nickname: '超级管理员',
      role: 'super',
      isActive: true
    });
    
    admin.setPassword(process.env.ADMIN_PASSWORD || 'admin123');
    await admin.save();
  }
}

start().catch(console.error);

export default app.callback()