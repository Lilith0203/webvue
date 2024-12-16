<template>
    <div class="grid-painter">
      <!-- 颜色选择器 -->
      <div class="color-picker">
        <input type="color" v-model="currentColor" />
        <div class="color-history">
          <div 
            v-for="(color, index) in colorHistory" 
            :key="index"
            :style="{ backgroundColor: color }"
            class="color-item"
            @click="currentColor = color"
          ></div>
        </div>
      </div>
  
      <!-- 网格控制 -->
      <div class="grid-controls">
        <input 
          type="number" 
          v-model.number="gridSize" 
          min="1" 
          max="32"
          @change="createGrid"
        >
        <button @click="clearGrid">清除</button>
        <button @click="saveGrid">保存</button>
      </div>
  
      <!-- 网格画布 -->
      <div 
        class="grid-container"
        :style="{
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`
        }"
      >
        <div 
          v-for="(cell, index) in gridCells" 
          :key="index"
          class="grid-cell"
          :style="{ backgroundColor: cell.color }"
          @click="paintCell(index)"
          @mouseover="handleMouseOver(index)"
          @mousedown="isDrawing = true"
          @mouseup="isDrawing = false"
        ></div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, onUnmounted } from 'vue'
  
  const gridSize = ref(16)  // 默认16x16
  const currentColor = ref('#000000')  // 当前选择的颜色
  const gridCells = ref([])  // 网格数据
  const isDrawing = ref(false)  // 是否正在绘制
  const colorHistory = ref(['#000000', '#FF0000', '#00FF00', '#0000FF'])  // 颜色历史
  
  // 创建网格
  const createGrid = () => {
    gridCells.value = Array(gridSize.value * gridSize.value)
      .fill()
      .map(() => ({ color: '#FFFFFF' }))
  }
  
  // 绘制单元格
  const paintCell = (index) => {
    gridCells.value[index].color = currentColor.value
    // 添加到颜色历史
    if (!colorHistory.value.includes(currentColor.value)) {
      colorHistory.value.push(currentColor.value)
      if (colorHistory.value.length > 10) {  // 限制历史记录数量
        colorHistory.value.shift()
      }
    }
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
    gap: 20px;
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
    aspect-ratio: 1;
    cursor: pointer;
    transition: background-color 0.1s;
  }
  
  .grid-cell:hover {
    opacity: 0.8;
  }
  
  .color-picker {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .color-picker input[type="color"] {
    width: 50px;
    height: 50px;
    padding: 0;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .color-history {
    display: flex;
    gap: 5px;
  }
  
  .color-item {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid #ccc;
  }
  
  .color-item:hover {
    transform: scale(1.1);
  }
  </style>