import { refreshImageUrls, clearImageSignatureCache } from '../utils/image'

class ImageRefreshService {
  constructor() {
    this.refreshTimer = null
    this.refreshInterval = 60 * 60 * 1000 // 60分钟，单位毫秒
    
    // 检查是否是首次访问或者上次刷新时间不存在
    const lastRefreshTimeStr = localStorage.getItem('last_image_refresh_time')
    const isFirstVisit = !lastRefreshTimeStr
    
    this.lastRefreshTime = isFirstVisit ? 0 : parseInt(lastRefreshTimeStr)
    
    // 如果是首次访问，设置标志，强制刷新
    this.forceRefreshOnStart = isFirstVisit
  }

  // 检查是否需要刷新图片（基于上次刷新时间）
  needsRefresh() {
    // 如果是首次访问，强制刷新
    if (this.forceRefreshOnStart) {
      this.forceRefreshOnStart = false // 重置标志
      return true
    }
    
    const now = Date.now()
    const timeSinceLastRefresh = now - this.lastRefreshTime
    
    // 如果超过刷新间隔或者上次刷新时间不合理（未来时间），则需要刷新
    const needsRefresh = timeSinceLastRefresh >= this.refreshInterval || timeSinceLastRefresh < 0
    
    return needsRefresh
  }

  // 刷新页面上所有static.lilithu.com的图片
  async refreshAllImages() {
    // 获取所有图片元素
    const images = document.querySelectorAll('img')
    const urlsToRefresh = []
    const imageMap = new Map() // 用于存储图片元素和它们的原始URL

    // 收集需要刷新的URL和对应的图片元素
    images.forEach(img => {
      const originalSrc = img.dataset.originalSrc || img.src
      if (originalSrc && originalSrc.includes('static.lilithu.com')) {
        urlsToRefresh.push(originalSrc)
        
        // 保存原始URL到dataset
        if (!img.dataset.originalSrc) {
          img.dataset.originalSrc = originalSrc
        }
        
        // 将图片元素添加到映射中
        if (!imageMap.has(originalSrc)) {
          imageMap.set(originalSrc, [])
        }
        imageMap.get(originalSrc).push(img)
      }
    })

    if (urlsToRefresh.length > 0) {
      try {
        // 批量刷新URL
        const refreshedUrls = await refreshImageUrls(urlsToRefresh)
        
        // 更新图片URL
        let updatedCount = 0
        
        // 遍历刷新后的URL
        for (let i = 0; i < urlsToRefresh.length; i++) {
          const originalUrl = urlsToRefresh[i]
          const refreshedUrl = refreshedUrls[i]
          
          // 获取与此URL关联的所有图片元素
          const imgElements = imageMap.get(originalUrl) || []
          
          // 更新每个图片元素的src
          imgElements.forEach(img => {
            if (img.src !== refreshedUrl) {
              img.src = refreshedUrl
              updatedCount++
            }
          })
        }
        
        // 更新最后刷新时间
        this.lastRefreshTime = Date.now()
        localStorage.setItem('last_image_refresh_time', this.lastRefreshTime.toString())
        
        return {
          total: urlsToRefresh.length,
          refreshed: refreshedUrls.length,
          updated: updatedCount
        }
      } catch (error) {
        console.error('批量刷新图片URL失败:', error)
        throw error
      }
    } else {
      return {
        total: 0,
        refreshed: 0,
        updated: 0
      }
    }
  }

  // 检查并刷新图片（如果需要）
  async checkAndRefreshImages() {
    if (this.needsRefresh()) {
      // 如果需要刷新，先清除缓存
      clearImageSignatureCache()
      // 然后刷新所有图片
      return await this.refreshAllImages()
    }
    return null
  }

  // 开始定时刷新
  startAutoRefresh() {
    // 页面加载时立即检查是否需要刷新
    setTimeout(() => {
      this.checkAndRefreshImages()
    }, 2000) // 延迟2秒，确保页面上的图片都已加载
    
    // 设置定时器
    this.refreshTimer = setInterval(() => {
      this.checkAndRefreshImages()
    }, this.refreshInterval)
  }

  // 停止定时刷新
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }
}

export const imageRefreshService = new ImageRefreshService()