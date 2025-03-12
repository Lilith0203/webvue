import axios from '../api'

// 标签颜色映射
export let tagColors = {}

// 初始化标签颜色
export const initTagColors = async () => {
  try {
    const response = await axios.get('/colors?category=2')
    const colors = response.data.data
    
    // 将颜色数据转换为 tagColors 格式
    tagColors = colors.reduce((acc, color) => {
      acc[color.name] = color.code
      return acc
    }, {})
  } catch (error) {
    console.error('加载标签颜色失败:', error)
  }
}

// 获取标签颜色
export const getTagColor = (tag) => {
    // 如果没有预设颜色，则根据字符串生成一个固定的颜色
    if (!tagColors[tag]) {
      let hash = 0
      for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash)
      }
      const hue = hash % 360
      return `hsl(${hue}, 70%, 50%)`
    }
    return tagColors[tag]
}

// 根据背景色计算文字颜色
export const getTextColor = (bgColor) => {
    // 将颜色转换为RGB
    let color = bgColor
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      // 计算亮度
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      return brightness > 220 ? '#000000' : '#ffffff'
    } else if (color.startsWith('hsl')) {
      // 对于HSL颜色，亮度小于50%使用白色文字
      const l = parseInt(color.match(/\d+/g)[2])
      return l < 60 ? '#ffffff' : '#000000'
    }
    return '#000000'
}