import axios from '../api'

// 新建工具文件存放图片签名相关逻辑
const SIGNATURE_EXPIRE_TIME = 3480000 // 58分钟过期，单位毫秒
const SIGNATURE_CACHE_KEY = 'image_signatures'

// 从 localStorage 初始化缓存
const signatureCache = new Map(JSON.parse(localStorage.getItem(SIGNATURE_CACHE_KEY) || '[]'))

const getImageSignature = async (url) => {
  // 检查缓存是否存在且未过期
  const cached = signatureCache.get(url)
  if (cached && cached.expireTime > Date.now()) {
    return cached.signature
  }
   try {
    const response = await axios.post('/oss-refresh', { url })
    const signature = response.data.url
    // 存入缓存
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
  } catch (error) {
    console.error('获取图片签名失败:', error)
    return null
  }
}

export const vImage = {
  mounted: async (el, binding) => {
    const url = binding.value
   if (!url) return
    try {
     const signature = await getImageSignature(url)
     if (signature) {
       el.src = signature
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
    try {
      const response = await axios.post('/oss-refresh', { url })
      return response.data.url
    } catch (error) {
      console.error('刷新图片URL失败:', error)
      return url // 刷新失败时返回原URL
    }
}

// 批量刷新图片URL
export const refreshImageUrls = async (urls) => {
  if (!urls || urls.length === 0) return []
  
  try {
    const response = await axios.post('/oss-refresh', { urls })
    return response.data.urls
  } catch (error) {
    console.error('批量刷新图片URL失败:', error)
    return urls // 刷新失败时返回原URLs
  }
}

// 清除图片签名缓存
export const clearImageSignatureCache = () => {
  signatureCache.clear()
  localStorage.removeItem(SIGNATURE_CACHE_KEY)
}