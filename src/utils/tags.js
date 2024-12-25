// 标签颜色映射
export const tagColors = {
    // 技术类
    '前端': '#99CCCC',
    'React': '#61dafb',
    'JavaScript': '#f7df1e',
    'TypeScript': '#3178c6',
    'Node.js': '#339933',
    'Python': '#3776ab',
    
    // 领域类
    '编程': '#738ABF',
    '手工': '#E1ABCE',
    '全栈': '#7952b3',
    '设计': '#ff7f50',
    '数据库': '#336791',
    
    // 状态类
    '进行中': '#899980',
    '已完成': '#17a2b8',
    '规划中': '#ffc107',
    
    // 类型类
    '项目': '#0366d6',
    '网站': '#fc6d26',
    '教程': '#563d7c',
    '工具': '#ff6b6b'
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