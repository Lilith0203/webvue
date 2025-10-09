import axios from '../api'

// 新建工具文件存放图片签名相关逻辑
const SIGNATURE_EXPIRE_TIME = 3480000 // 58分钟过期，单位毫秒
const SIGNATURE_CACHE_KEY = 'image_signatures'
const MAX_RETRIES = 3 // 最大重试次数

// 从 localStorage 初始化缓存
const signatureCache = new Map(JSON.parse(localStorage.getItem(SIGNATURE_CACHE_KEY) || '[]'))

// 添加重试逻辑的包装函数
const withRetry = async (fn, maxRetries = MAX_RETRIES) => {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      // 指数退避策略，每次重试等待时间增加
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
};

const getImageSignature = async (url) => {
  // 检查缓存是否存在且未过期
  const cached = signatureCache.get(url)
  if (cached && cached.expireTime > Date.now()) {
    return cached.signature
  }
  
  return withRetry(async () => {
    const response = await axios.post('/oss-refresh', { url })
    const signature = response.data.url
    
    // 存入缓存
    const cacheData = {
      signature,
      expireTime: Date.now() + SIGNATURE_EXPIRE_TIME
    }
    signatureCache.set(url, cacheData)

    // 更新 localStorage
    localStorage.setItem(
      SIGNATURE_CACHE_KEY, 
      JSON.stringify(Array.from(signatureCache.entries()))
    )
    
    return signature
  });
}

// 获取视频签名（不添加图片处理参数）
const getVideoSignature = async (url) => {
  // 检查缓存是否存在且未过期
  const cached = signatureCache.get(url)
  if (cached && cached.expireTime > Date.now()) {
    return cached.signature
  }
  
  return withRetry(async () => {
    const response = await axios.post('/oss-refresh', { url })
    const signature = response.data.url
    
    // 存入缓存
    const cacheData = {
      signature,
      expireTime: Date.now() + SIGNATURE_EXPIRE_TIME
    }
    signatureCache.set(url, cacheData)

    // 更新 localStorage
    localStorage.setItem(
      SIGNATURE_CACHE_KEY, 
      JSON.stringify(Array.from(signatureCache.entries()))
    )
    
    return signature
  });
}

// 图片加载错误处理函数
const handleImageError = async (el, url, retryCount = 0) => {
  if (retryCount >= MAX_RETRIES) {
    console.error(`图片加载失败，已达最大重试次数: ${url}`);
    return;
  }
  
  // 清除该URL的缓存
  signatureCache.delete(url);
  
  try {
    // 强制刷新签名
    const signature = await getImageSignature(url);
    if (signature) {
      el.src = signature;
    }
  } catch (error) {
    console.error('重试加载图片失败:', error);
    // 递归重试，增加重试计数
    setTimeout(() => handleImageError(el, url, retryCount + 1), 1000);
  }
};

export const vImage = {
  mounted: async (el, binding) => {
    const url = binding.value
    if (!url) return
    
    try {
      const signature = await getImageSignature(url)
      if (signature) {
        el.src = signature
        // 添加错误处理
        el.onerror = () => handleImageError(el, url)
      } else {
        el.src = url
      }
    } catch (error) {
      console.error('加载图片失败:', error)
      el.src = url
    }
  },
  updated: async (el, binding) => {
    if (binding.value !== binding.oldValue) {
      const url = binding.value
      if (!url) return
      
      try {
        const signature = await getImageSignature(url)
        if (signature) {
          el.src = signature
          // 添加错误处理
          el.onerror = () => handleImageError(el, url)
        } else {
          el.src = url
        }
      } catch (error) {
        console.error('更新图片失败:', error)
        el.src = url
      }
    }
  }
}

// 刷新单个图片URL
export const refreshImageUrl = async (url) => {
  return withRetry(async () => {
    const response = await axios.post('/oss-refresh', { url })
    return response.data.url
  });
}

// 批量刷新图片URL
export const refreshImageUrls = async (urls) => {
  if (!urls || urls.length === 0) return []
  
  return withRetry(async () => {
    const response = await axios.post('/oss-refresh', { urls })
    return response.data.urls || urls
  });
}

// 清除图片签名缓存
export const clearImageSignatureCache = () => {
  signatureCache.clear()
  localStorage.removeItem(SIGNATURE_CACHE_KEY)
}

// 添加预加载函数
export const preloadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
};

// 视频加载错误处理函数
const handleVideoError = async (el, url, retryCount = 0) => {
  if (retryCount >= MAX_RETRIES) {
    console.error(`视频加载失败，已达最大重试次数: ${url}`);
    return;
  }
  
  // 清除该URL的缓存
  signatureCache.delete(url);
  
  try {
    // 强制刷新签名
    const signature = await getVideoSignature(url);
    if (signature) {
      el.src = signature;
    }
  } catch (error) {
    console.error('重试加载视频失败:', error);
    // 递归重试，增加重试计数
    setTimeout(() => handleVideoError(el, url, retryCount + 1), 1000);
  }
};

export const vVideo = {
  mounted: async (el, binding) => {
    const url = binding.value
    if (!url) return
    
    try {
      const signature = await getVideoSignature(url)
      if (signature) {
        el.src = signature
        // 添加错误处理
        el.onerror = () => handleVideoError(el, url)
      } else {
        el.src = url
      }
    } catch (error) {
      console.error('加载视频失败:', error)
      el.src = url
    }
  },
  updated: async (el, binding) => {
    if (binding.value !== binding.oldValue) {
      const url = binding.value
      if (!url) return
      
      try {
        const signature = await getVideoSignature(url)
        if (signature) {
          el.src = signature
          // 添加错误处理
          el.onerror = () => handleVideoError(el, url)
        } else {
          el.src = url
        }
      } catch (error) {
        console.error('更新视频失败:', error)
        el.src = url
      }
    }
  }
}

// 刷新单个视频URL
export const refreshVideoUrl = async (url) => {
  return withRetry(async () => {
    const response = await axios.post('/oss-refresh', { url })
    return response.data.url
  });
}

// 添加全局图片错误处理
export const setupGlobalImageErrorHandler = () => {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('error', (event) => {
      if (event.target.tagName === 'IMG' && event.target.src.includes('static.lilithu.com')) {
        handleImageError(event.target, event.target.dataset.originalSrc || event.target.src);
      } else if (event.target.tagName === 'VIDEO' && event.target.src.includes('static.lilithu.com')) {
        handleVideoError(event.target, event.target.dataset.originalSrc || event.target.src);
      }
    }, true); // 使用捕获阶段
  });
};