import { refreshImageUrls } from '../utils/image'

class ImageRefreshService {
  constructor() {
    this.refreshTimer = null
    this.refreshInterval = 60 * 60 * 1000 // 60分钟，单位毫秒
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
      } catch (error) {
        console.error('批量刷新图片URL失败:', error)
      }
    }
  }

  // 开始定时刷新
  startAutoRefresh() {
    this.refreshTimer = setInterval(() => {
      this.refreshAllImages()
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