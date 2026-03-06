import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  url: String,
  name: String,
  type: String
}, { _id: false });

const feedbackSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '反馈标题不能为空'],
    trim: true
  },
  content: {
    type: String,
    required: [true, '反馈内容不能为空'],
    trim: true
  },
  type: {
    type: Number,
    enum: [0, 1, 2, 3],
    default: 0,
    comment: '0-其它、1-交警、2-路政、3-地保办'
  },
  nickname: {
    type: String,
    trim: true,
    default: '匿名'
  },
  phone: {
    type: String,
    required: [true, '联系电话不能为空'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^1[3-9]\d{9}$/.test(v);
      },
      message: '请输入有效的手机号码'
    }
  },
  attachments: {
    type: [attachmentSchema],
    default: []
  },
  location: {
    type: String,
    required: [true, '发生地点不能为空'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, '发生日期不能为空'],
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'resolved', 'closed'],
    default: 'pending',
    comment: 'pending-待处理、processing-处理中、resolved-已解决、closed-已关闭'
  },
  adminNotes: {
    type: String,
    trim: true,
    default: ''
  },
  keywords: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

feedbackSchema.index({ title: 'text', content: 'text', keywords: 'text' });
feedbackSchema.index({ type: 1, status: 1, date: -1 });

export default mongoose.model('Feedback', feedbackSchema);
