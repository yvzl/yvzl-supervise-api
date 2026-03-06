import OSS from 'ali-oss';

const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
};

// 创建 OSS 客户端实例
export const ossClient = new OSS(ossConfig);

// 上传文件到 OSS
export async function uploadFileToOSS(file, objectName) {
  try {
    const result = await ossClient.put(objectName, file);
    return result.url;
  } catch (error) {
    console.error('OSS 上传失败:', error);
    throw new Error(`OSS 上传失败：${error.message}`);
  }
}

// 从本地文件路径上传
export async function uploadLocalFileToOSS(localPath, objectName) {
  try {
    const result = await ossClient.put(objectName, localPath);
    return result.url;
  } catch (error) {
    console.error('OSS 上传失败:', error);
    throw new Error(`OSS 上传失败：${error.message}`);
  }
}

// 删除 OSS 文件
export async function deleteOSSFile(objectName) {
  try {
    await ossClient.delete(objectName);
  } catch (error) {
    console.error('OSS 删除失败:', error);
    throw new Error(`OSS 删除失败：${error.message}`);
  }
}

export default ossClient;
