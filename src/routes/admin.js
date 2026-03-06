import Router from 'koa-router';
import Admin from '../models/Admin.js';
import fs from 'fs';
import path from 'path';

const router = new Router({ prefix: '/api/admin' });

const OSS_UPLOAD_DIR = process.env.OSS_UPLOAD_DIR || './uploads';

router.post('/login', async (ctx) => {
  try {
    const { username, password } = ctx.request.body;

    const admin = await Admin.findOne({ username });

    if (!admin || !admin.validatePassword(password)) {
      ctx.status = 401;
      ctx.body = {
        success: false,
        message: '账号或密码错误'
      };
      return;
    }

    if (!admin.isActive) {
      ctx.status = 403;
      ctx.body = {
        success: false,
        message: '账号已被禁用'
      };
      return;
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = await generateToken(admin);

    ctx.body = {
      success: true,
      message: '登录成功',
      data: {
        token,
        admin: admin.toSafeObject()
      }
    };
  } catch (error) {
    console.error('Login error:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

router.get('/info', async (ctx) => {
  try {
    const adminId = ctx.state.adminId;
    
    const admin = await Admin.findById(adminId);
    
    if (!admin) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        message: '管理员不存在'
      };
      return;
    }
    
    ctx.body = {
      success: true,
      data: admin.toSafeObject()
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

router.put('/info', async (ctx) => {
  try {
    const adminId = ctx.state.adminId;
    const { nickname, password, avatar } = ctx.request.body;

    const admin = await Admin.findById(adminId);

    if (!admin) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        message: '管理员不存在'
      };
      return;
    }

    // 不允许修改用户名
    if (ctx.request.body.username) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: '账号名不允许修改'
      };
      return;
    }

    if (avatar !== undefined) {
      admin.avatar = avatar;
    }

    if (nickname) {
      admin.nickname = nickname;
    }

    if (password) {
      admin.setPassword(password);
    }

    await admin.save();

    ctx.body = {
      success: true,
      message: '更新成功',
      data: admin.toSafeObject()
    };
  } catch (error) {
    console.error('Update admin error:', error);
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

router.get('/list', async (ctx) => {
  try {
    const admins = await Admin.find({ isActive: true }).select('-passwordHash -salt -__v');

    ctx.body = {
      success: true,
      data: admins.map(admin => admin.toSafeObject())
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

router.post('/avatar', async (ctx) => {
  try {
    const adminId = ctx.state.adminId;
    
    const files = ctx.request.files;
    let file = null;
    if (files) {
      if (Array.isArray(files)) {
        file = files[0];
      } else if (files instanceof Map) {
        const values = Array.from(files.values()).flat();
        file = values[0];
      } else if (typeof files === 'object') {
        const values = Object.values(files).flat();
        file = values[0];
      }
    }

    if (!file) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: '没有上传文件'
      };
      return;
    }

    const mimetype = file.mimetype || file.type || '';
    if (!mimetype.startsWith('image/')) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: '请上传图片文件'
      };
      return;
    }

    const originalFilename = file.originalFilename || file.name || file.newFilename || '';
    const filepath = file.filepath || file.path || '';
    const size = file.size || 0;

    // 限制 2MB
    if (size > 2 * 1024 * 1024) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: '头像大小不能超过 2MB'
      };
      return;
    }

    const fileExt = path.extname(originalFilename);
    const fileName = `avatar-${adminId}-${Date.now()}${fileExt}`;
    const filePath = path.join(OSS_UPLOAD_DIR, fileName);

    if (!fs.existsSync(OSS_UPLOAD_DIR)) {
      fs.mkdirSync(OSS_UPLOAD_DIR, { recursive: true });
    }

    if (filepath && fs.existsSync(filepath)) {
      const fileData = fs.readFileSync(filepath);
      fs.writeFileSync(filePath, fileData);
      fs.unlinkSync(filepath);
    }

    // 更新管理员头像
    const admin = await Admin.findById(adminId);
    if (admin) {
      admin.avatar = `/uploads/${fileName}`;
      await admin.save();
    }

    ctx.body = {
      success: true,
      message: '头像更新成功',
      data: {
        avatar: `/uploads/${fileName}`
      }
    };
  } catch (error) {
    console.error('Avatar upload error:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

async function generateToken(admin) {
  // token 格式：adminId-username-timestamp
  const adminId = String(admin._id);
  const username = admin.username;
  const timestamp = Date.now();
  return `${adminId}-${username}-${timestamp}`;
}

export default router;
