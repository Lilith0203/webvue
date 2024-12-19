import axios from '../api'

// 检查是否是需要刷新的图片URL
const needsRefresh = (url) => {
  return url && url.includes('static.lilithu.com')
}

export const vImage = {
  mounted: async (el, binding) => {
    if (el.tagName === 'IMG') {
      // 保存原始URL
      el.dataset.originalSrc = binding.value

      // 如果是需要刷新的URL，立即刷新
      if (needsRefresh(binding.value)) {
        try {
          const newUrl = await refreshImageUrl(binding.value)
          el.src = newUrl
        } catch (error) {
          console.error('刷新图片URL失败:', error)
          el.src = binding.value
        }
      }

      // 添加错误处理
      el.onerror = async () => {
        if (needsRefresh(el.src)) {
          try {
            const newUrl = await refreshImageUrl(el.dataset.originalSrc)
            el.src = newUrl
          } catch (error) {
            console.error('刷新失败的图片URL失败:', error)
          }
        }
      }
    }
  },
  updated: async (el, binding) => {
    if (el.tagName === 'IMG' && binding.value !== binding.oldValue) {
      el.dataset.originalSrc = binding.value
      
      if (needsRefresh(binding.value)) {
        try {
          const newUrl = await refreshImageUrl(binding.value)
          el.src = newUrl
        } catch (error) {
          console.error('刷新图片URL失败:', error)
          el.src = binding.value
        }
      } else {
        el.src = binding.value
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