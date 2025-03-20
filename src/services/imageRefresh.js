import { refreshImageUrls, clearImageSignatureCache } from '../utils/image'

class ImageRefreshService {
  constructor() {
    this.refreshTimer = null
    this.refreshInterval = 60 * 60 * 1000 // 60分钟，单位毫秒
    this.lastRefreshTime = parseInt(localStorage.getItem('last_image_refresh_time') || '0')
  }

  // 检查是否需要刷新图片（基于上次刷新时间）
  needsRefresh() {
    const now = Date.now()
    const timeSinceLastRefresh = now - this.lastRefreshTime
    
    // 如果超过刷新间隔或者上次刷新时间不合理（未来时间），则需要刷新
    return timeSinceLastRefresh >= this.refreshInterval || timeSinceLastRefresh < 0
  }

  // 刷新页面上所有static.lilithu.com的图片
  async refreshAllImages() {
    // 获取所有图片元素
    const images = document.querySelectorAll('img')
    const urlsToRefresh = []

    images.forEach(img => {
      const originalSrc = img.dataset.originalSrc || img.src
      if (originalSrc && originalSrc.includes('static.lilithu.com')) {
        urlsToRefresh.push(originalSrc)
        // 保存原始URL
        if (!img.dataset.originalSrc) {
          img.dataset.originalSrc = originalSrc
        }
      }
    })

    if (urlsToRefresh.length > 0) {
      try {
        const refreshedUrls = await refreshImageUrls(urlsToRefresh)
        
        // 更新图片URL
        images.forEach(img => {
          const originalSrc = img.dataset.originalSrc || img.src
          if (originalSrc && originalSrc.includes('static.lilithu.com')) {
            const index = urlsToRefresh.indexOf(originalSrc)
            if (index !== -1) {
              img.src = refreshedUrls[index]
            }
          }
        })
        
        // 更新最后刷新时间
        this.lastRefreshTime = Date.now()
        localStorage.setItem('last_image_refresh_time', this.lastRefreshTime.toString())
        
        return {
          total: urlsToRefresh.length,
          refreshed: refreshedUrls.length
        }
      } catch (error) {
        console.error('批量刷新图片URL失败:', error)
        throw error
      }
    }
    
    return {
      total: 0,
      refreshed: 0
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
    this.checkAndRefreshImages()
    
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