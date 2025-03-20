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
    
    console.log('图片刷新服务初始化', {
      isFirstVisit,
      lastRefreshTime: this.lastRefreshTime ? new Date(this.lastRefreshTime).toLocaleString() : '从未刷新',
      forceRefreshOnStart: this.forceRefreshOnStart
    })
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
        let updatedCount = 0
        images.forEach(img => {
          const originalSrc = img.dataset.originalSrc || img.src
          if (originalSrc && originalSrc.includes('static.lilithu.com')) {
            const index = urlsToRefresh.indexOf(originalSrc)
            if (index !== -1) {
              const oldSrc = img.src
              img.src = refreshedUrls[index]
              if (oldSrc !== img.src) {
                updatedCount++
              }
            }
          }
        })
        
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