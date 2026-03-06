import Router from 'koa-router';
import Feedback from '../models/Feedback.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import {uploadFileToOSS} from '../config/oss.js';

const router = new Router({ prefix: '/api/feedback' });

// OSS 配置
const OSS_UPLOAD_DIR = process.env.OSS_UPLOAD_DIR || 'uploads/';

// 允许的文件类型
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'text/plain'
];

// 最大文件大小 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

router.post('/submit', async (ctx) => {
  try {
    const { title, content, type, nickname, phone, location, date } = ctx.request.body;

    // 处理上传的文件 - koa-body 6.x 处理后的文件在 ctx.request.files 中
    const attachments = [];
    const files = ctx.request.files;
    
    // 将 files 转换为数组 - 兼容多种格式
    let fileArray = [];
    if (files) {
      if (Array.isArray(files)) {
        fileArray = files;
      } else if (files instanceof Map) {
        // 如果是 Map，获取所有值并扁平化
        fileArray = Array.from(files.values()).flat();
      } else if (typeof files === 'object') {
        // 如果是普通对象，获取所有值并扁平化
        fileArray = Object.values(files).flat();
      }
    }

    if (fileArray.length > 0) {
      for (const file of fileArray) {
        // koa-body 6.x 使用 different 属性名
        const mimetype = file.mimetype || file.type || '';
        const originalFilename = file.originalFilename || file.name || file.newFilename || '';
        const filepath = file.filepath || file.path || '';
        const size = file.size || 0;
        
        if (!mimetype) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            message: `无法识别的文件：${originalFilename || 'unknown'}`
          };
          return;
        }
        
        if (!ALLOWED_MIME_TYPES.includes(mimetype) && !mimetype.startsWith('image/')) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            message: `不支持的文件类型：${originalFilename}`
          };
          return;
        }

        if (size > MAX_FILE_SIZE) {
          ctx.status = 400;
          ctx.body = {
            success: false,
            message: `文件过大：${originalFilename}（最大 10MB）`
          };
          return;
        }

        const fileExt = path.extname(originalFilename);
        const fileName = `${uuidv4()}${fileExt}`;
        const objectName = `${OSS_UPLOAD_DIR}${fileName}`;

        // 直接上传到 OSS（koa-body 已处理为临时文件）
        if (filepath && fs.existsSync(filepath)) {
          const ossUrl = await uploadFileToOSS(filepath, objectName);
          // 删除临时文件
          fs.unlinkSync(filepath);

          attachments.push({
            url: ossUrl,
            name: originalFilename,
            type: mimetype
          });
        }
      }
    }

    // 解析 attachments JSON 字符串（如果有）
    let parsedAttachments = [];
    if (ctx.request.body.attachments) {
      try {
        parsedAttachments = typeof ctx.request.body.attachments === 'string'
          ? JSON.parse(ctx.request.body.attachments)
          : ctx.request.body.attachments;
      } catch (e) {
        parsedAttachments = [];
      }
    }

    const allAttachments = [...attachments, ...parsedAttachments];

    const feedback = new Feedback({
      title,
      content,
      type: type || 0,
      nickname: nickname || '匿名',
      phone,
      location,
      date: date || new Date(),
      attachments: allAttachments,
      keywords: extractKeywords(title, content)
    });

    await feedback.save();

    ctx.body = {
      success: true,
      message: '提交成功',
      data: { id: feedback._id }
    };
  } catch (error) {
    console.error('Submit error:', error);
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

router.get('/list', async (ctx) => {
  try {
    const { page = 1, limit = 10, type, status, keyword } = ctx.query;

    const query = {};

    if (type !== undefined && type !== '') {
      query.type = parseInt(type);
    }

    if (status) {
      query.status = status;
    }

    if (keyword) {
      // 使用正则表达式进行模糊搜索
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escapedKeyword, $options: 'i' } },
        { content: { $regex: escapedKeyword, $options: 'i' } },
        { location: { $regex: escapedKeyword, $options: 'i' } },
        { nickname: { $regex: escapedKeyword, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [feedbacks, total] = await Promise.all([
      Feedback.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-__v'),
      Feedback.countDocuments(query)
    ]);
    
    ctx.body = {
      success: true,
      data: {
        list: feedbacks,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

router.get('/:id', async (ctx) => {
  try {
    const feedback = await Feedback.findById(ctx.params.id);
    
    if (!feedback) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        message: '反馈不存在'
      };
      return;
    }
    
    ctx.body = {
      success: true,
      data: feedback
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

router.put('/:id', async (ctx) => {
  try {
    const { status, adminNotes, keywords } = ctx.request.body;

    const updateData = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (keywords) updateData.keywords = keywords;

    const feedback = await Feedback.findByIdAndUpdate(
      ctx.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!feedback) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        message: '反馈不存在'
      };
      return;
    }

    ctx.body = {
      success: true,
      message: '更新成功',
      data: feedback
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

router.post('/upload', async (ctx) => {
  try {
    // koa-body 6.x 处理后的文件在 ctx.request.files 中
    const files = ctx.request.files;
    
    // 获取第一个文件
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
    const originalFilename = file.originalFilename || file.name || file.newFilename || '';
    const filepath = file.filepath || file.path || '';
    const size = file.size || 0;

    if (!mimetype) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: '无法识别的文件'
      };
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(mimetype) && !mimetype.startsWith('image/')) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: `不支持的文件类型：${originalFilename}`
      };
      return;
    }

    if (size > MAX_FILE_SIZE) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        message: `文件过大（最大 10MB）`
      };
      return;
    }

    const fileExt = path.extname(originalFilename);
    const fileName = `${uuidv4()}${fileExt}`;
    const objectName = `${OSS_UPLOAD_DIR}${fileName}`;

    // 直接上传到 OSS（koa-body 已处理为临时文件）
    if (filepath && fs.existsSync(filepath)) {
      const ossUrl = await uploadFileToOSS(filepath, objectName);
      // 删除临时文件
      fs.unlinkSync(filepath);

      ctx.body = {
        success: true,
        data: {
          url: ossUrl,
          name: originalFilename,
          type: mimetype
        }
      };
    }
  } catch (error) {
    console.error('Upload error:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      message: error.message
    };
  }
});

function extractKeywords(title, content) {
  const text = `${title} ${content}`;
  const commonWords = ['的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '就'];
  const words = text.split(/[\s,，。、！？；：""''（）()【】\[\]{}]/)
    .filter(word => word.length > 1 && !commonWords.includes(word))
    .slice(0, 10);
  return [...new Set(words)];
}

export default router;
