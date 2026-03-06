import mongoose from 'mongoose';
import crypto from 'crypto';

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, '账号不能为空'],
    unique: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  salt: {
    type: String,
    required: true
  },
  nickname: {
    type: String,
    trim: true,
    default: '管理员'
  },
  avatar: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['admin', 'super'],
    default: 'admin'
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

adminSchema.methods.setPassword = function(password) {
  this.salt = crypto.randomBytes(16).toString('hex');
  this.passwordHash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex');
};

adminSchema.methods.validatePassword = function(password) {
  const hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64, 'sha512').toString('hex');
  return this.passwordHash === hash;
};

adminSchema.methods.toSafeObject = function() {
  return {
    id: this._id,
    username: this.username,
    nickname: this.nickname,
    avatar: this.avatar,
    role: this.role,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

export default mongoose.model('Admin', adminSchema);
