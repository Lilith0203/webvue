<template>
    <div class="grid-painter">
      <!-- 添加样式选择器 -->
      <div class="style-controls">
        <button 
          :class="{ active: gridStyle === 'normal' }" 
          @click="gridStyle = 'normal'"
        >
          普通网格
        </button>
        <button 
          :class="{ active: gridStyle === 'brick' }" 
          @click="gridStyle = 'brick'"
        >
          墙砖式
        </button>
      </div>
      <!-- 颜色选择器 -->
      <div class="color-tools">
        <div class="preset-colors">
        <div 
          v-for="color in presetColors" 
          :key="color"
          class="color-item"
          :style="{ backgroundColor: color }"
          :class="{ active: currentColor === color }"
          @click="selectColor(color)"></div>
        </div>

        <!-- 自定义颜色 -->
        <div class="custom-color">
          <input 
            type="color" 
            v-model="customColor"
            @change="addCustomColor"
          />
          <span>自定义颜色</span>
        </div>
      </div>

      <!-- 最近使用的颜色 -->
      <div class="recent-colors">
        <div 
          v-for="(color, index) in recentColors" 
          :key="index"
          class="color-item"
          :style="{ backgroundColor: color }"
          :class="{ active: currentColor === color }"
          @click="selectColor(color)"
        ></div>
      </div>
  
      <!-- 网格画布 -->
      <div 
        class="grid-container"
        :class="{ 'brick-style': gridStyle === 'brick' }"
        :style="{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`
        }"
      >
        <div 
          v-for="(cell, index) in gridCells" 
          :key="index"
          class="grid-cell"
          :class="{
            'brick-cell': gridStyle === 'brick',
            'brick-offset': gridStyle === 'brick' && Math.floor(index / gridSize) % 2 === 1
          }"
          :style="{ 
            backgroundColor: cell.color,
            transform: gridStyle === 'brick' && Math.floor(index / gridSize) % 2 === 1 
            ? 'translateX(50%)' 
            : ''
          }"
          @click="paintCell(index)"
          @mouseover="handleMouseOver(index)"
          @mousedown="isDrawing = true"
          @mouseup="isDrawing = false"
        ></div>
      </div>

      <!-- 网格控制 -->
      <div class="grid-controls">
        <input 
          type="number" 
          v-model.number="gridSize" 
          min="1" 
          max="64"
          @change="createGrid"
        >
        <button @click="clearGrid">清除</button>
        <button @click="saveGrid">保存</button>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onUnmounted } from 'vue'
  
  const gridStyle = ref('normal')  // 'normal' 或 'brick'
  const gridSize = ref(32)  // 默认32x32
  const currentColor = ref('#000000')  // 当前选择的颜色
  const customColor = ref('#000000')
  const gridCells = ref([])  // 网格数据
  const isDrawing = ref(false)  // 是否正在绘制

  // 最近使用的颜色
  const recentColors = ref([])
  const maxRecentColors = 10
  
  // 预设颜色
  const presetColors = ref([
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#008000', '#800000', '#008080', '#FFC0CB', '#A52A2A',
    '#FFD700', '#808080', '#F0E68C', '#E6E6FA', '#98FB98'
  ])

  // 选择颜色
  const selectColor = (color) => {
    currentColor.value = color
    addToRecentColors(color)
  }

  // 添加自定义颜色
  const addCustomColor = () => {
    selectColor(customColor.value)
    if (!presetColors.value.includes(customColor.value)) {
      presetColors.value.push(customColor.value)
    }
  }

  // 添加到最近使用的颜色
  const addToRecentColors = (color) => {
    if (color === '#FFFFFF') return // 不记录白色（橡皮擦）
    const index = recentColors.value.indexOf(color)
    if (index > -1) {
      recentColors.value.splice(index, 1)
    }
    recentColors.value.unshift(color)
    if (recentColors.value.length > maxRecentColors) {
      recentColors.value.pop()
    }
  }

  // 创建网格
  const createGrid = () => {
    gridCells.value = Array(gridSize.value * gridSize.value)
      .fill()
      .map(() => ({ color: '#FFFFFF' }))
  }
  
  // 绘制单元格
  const paintCell = (index) => {
    gridCells.value[index].color = currentColor.value
    addToRecentColors(currentColor.value)
  }
  
  // 处理鼠标悬停
  const handleMouseOver = (index) => {
    if (isDrawing.value) {
      paintCell(index)
    }
  }
  
  // 清除网格
  const clearGrid = () => {
    gridCells.value = gridCells.value.map(() => ({ color: '#FFFFFF' }))
  }
  
  // 保存网格
  const saveGrid = () => {
    const canvas = document.createElement('canvas')
    const cellSize = 20  // 每个格子的像素大小
    canvas.width = gridSize.value * cellSize
    canvas.height = gridSize.value * cellSize
    const ctx = canvas.getContext('2d')
  
    // 绘制到canvas
    gridCells.value.forEach((cell, index) => {
      const x = (index % gridSize.value) * cellSize
      const y = Math.floor(index / gridSize.value) * cellSize
      ctx.fillStyle = cell.color
      ctx.fillRect(x, y, cellSize, cellSize)
    })
  
    // 转换为图片并下载
    const link = document.createElement('a')
    link.download = 'grid-painting.png'
    link.href = canvas.toDataURL()
    link.click()
  }
  
  // 防止在网格外继续绘制
  const stopDrawing = () => {
    isDrawing.value = false
  }
  
  onMounted(() => {
    createGrid()
    window.addEventListener('mouseup', stopDrawing)
  })
  
  onUnmounted(() => {
    window.removeEventListener('mouseup', stopDrawing)
  })
  </script>
  
  <style scoped>
  .grid-painter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
  }
  
  .grid-controls {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .grid-controls input {
    width: 60px;
    padding: 5px;
  }
  
  .grid-controls button {
    padding: 5px 15px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .grid-controls button:hover {
    background-color: #45a049;
  }
  
  .grid-container {
    display: grid;
    gap: 1px;
    background-color: #ccc;
    border: 1px solid #999;
    width: 500px;
    height: 500px;
  }
  
  .grid-cell {
    background-color: white;
    cursor: pointer;
    transition: background-color 0.1s;
  }
  
  .grid-cell:hover {
    opacity: 0.8;
  }

  .color-tools {
    display: flex;
    gap: 20px;
    align-items: center;
  }

  .preset-colors {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 5px;
    padding: 10px;
    background: #f5f5f5;
    border-radius: 8px;
  }
  
  .color-history {
    display: flex;
    gap: 5px;
  }
  
  .color-item {
    width: 25px;
    height: 25px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
  }
  
  .color-item:hover {
    transform: scale(1.1);
  }

  .color-item.active {
    border-color: #333;
  }

  .custom-color {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

.custom-color input[type="color"] {
    width: 25px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

.recent-colors {
  display: flex;
  gap: 5px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 8px;
}

.style-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.style-controls button {
  padding: 5px 15px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.style-controls button:hover {
  background-color: #45a049;
}

.style-controls button.active {
  background-color: #357a38;
  box-shadow: inset 0 0 5px rgba(0,0,0,0.2);
}

/* 墙砖样式 */
.grid-container.brick-style {
  position: relative;
}

.grid-cell.brick-cell {
  border-radius: 0;
  position: relative;
}

/* 为偶数行添加位移效果 */
.grid-cell.brick-offset {
  transform: translateX(50%);
}

/* 添加砖块纹理 */
.grid-cell.brick-cell::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

/* 保存按钮样式优化 */
.grid-controls button {
  position: relative;
  overflow: hidden;
}

.grid-controls button::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .grid-container {
    width: 100%;
    max-width: 500px;
    height: auto;
    aspect-ratio: 1;
  }
  
  .style-controls {
    flex-wrap: wrap;
    justify-content: center;
  }

  .preset-colors {
    grid-template-columns: repeat(8, 1fr);
  }

  .color-tools {
    flex-direction: column;
    align-items: stretch;
  }

  .recent-colors {
    overflow-x: auto;
    padding: 10px 5px;
  }
}
</style>