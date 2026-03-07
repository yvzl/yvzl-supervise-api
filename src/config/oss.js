import OSS from 'ali-oss';

let ossClientInstance = null;

// 获取 OSS 客户端（懒加载）
export function getOSSClient() {
  if (!ossClientInstance) {
    const ossConfig = {
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET
    };

    // 检查必要配置
    if (!ossConfig.accessKeyId || !ossConfig.accessKeySecret || !ossConfig.bucket) {
      // throw new Error("accessKeyId、accessKeySecret、bucket 必填");
      throw new Error(JSON.stringify(process.env));
    }

    ossClientInstance = new OSS(ossConfig);
  }
  return ossClientInstance;
}

// 上传文件到 OSS
export async function uploadFileToOSS(file, objectName) {
  try {
    const client = getOSSClient();
    const result = await client.put(objectName, file);
    return result.url;
  } catch (error) {
    console.error('OSS 上传失败:', error);
    throw new Error(`OSS 上传失败：${error.message}`);
  }
}

// 从本地文件路径上传
export async function uploadLocalFileToOSS(localPath, objectName) {
  try {
    const client = getOSSClient();
    const result = await client.put(objectName, localPath);
    return result.url;
  } catch (error) {
    console.error('OSS 上传失败:', error);
    throw new Error(`OSS 上传失败：${error.message}`);
  }
}

// 删除 OSS 文件
export async function deleteOSSFile(objectName) {
  try {
    const client = getOSSClient();
    await client.delete(objectName);
  } catch (error) {
    console.error('OSS 删除失败:', error);
    throw new Error(`OSS 删除失败：${error.message}`);
  }
}

export default getOSSClient;
