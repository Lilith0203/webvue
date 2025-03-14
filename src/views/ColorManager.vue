<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../api'
import { confirm } from '../utils/confirm'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const colors = ref({
  1: [],  // 材料颜色
  2: [],  // 文章标签颜色
  3: [],  // 格子图颜色
  4: []   // 收藏颜色
})

const newColor = ref({
  category: 1,  // 默认分类为材料
  name: '',
  code: '#000000',
  set: ''  // 添加合集属性
})

const editingColor = ref(null)

// 添加新颜色
const addColor = async () => {
  if (!newColor.value.code) return
  
  try {
    const response = await axios.post('/color/add', {
      ...newColor.value,
      set: newColor.value.set  // 确保包含合集属性
    })
    
    // 确保category对应的数组存在
    if (!colors.value[newColor.value.category]) {
      colors.value[newColor.value.category] = []
    }
    
    // 添加成功后更新列表
    colors.value[newColor.value.category].push(response.data)
    
    // 重置表单
    newColor.value = {
      category: 1,
      name: '',
      code: '#000000',
      set: ''  // 重置合集属性
    }
    loadColors()
  } catch (error) {
    console.error('添加颜色失败:', error)
  }
}

// 删除颜色
const deleteColor = async (category, id) => {
  if (await confirm('确定要删除这个颜色吗？')) {
    try {
      await axios.post(`/color/delete`, {
        id: id
      })
      colors.value[category] = colors.value[category].filter(color => color.id !== id)
    } catch (error) {
      console.error('删除颜色失败:', error)
    }
  }
}

// 从服务器加载颜色
const loadColors = async () => {
  try {
    const response = await axios.get('/colors')
    // 初始化所有分类
    colors.value = {
      1: [],
      2: [],
      3: [],
      4: []
    }
    // 将返回的颜色数据按category分类
    response.data.data.forEach(color => {
      if (colors.value[color.category]) {
        colors.value[color.category].push(color)
      }
    })
  } catch (error) {
    console.error('加载颜色失败:', error)
  }
}

// 获取分类名称的辅助函数
const getCategoryName = (category) => {
  const categoryMap = {
    1: '材料颜色',
    2: '标签颜色',
    3: '格子图颜色',
    4: '收藏颜色'
  }
  return categoryMap[category] || '未知分类'
}

// 开始编辑颜色
const startEdit = (category, color) => {
  editingColor.value = {
    ...color,
    category: category,
    set: color.set || ''  // 确保set属性存在
  }
}

// 保存编辑的颜色
const saveEdit = async () => {
  if (!editingColor.value) return
  
  try {
    const response = await axios.post('/color/edit', {
      id: editingColor.value.id,
      name: editingColor.value.name,
      code: editingColor.value.code,
      set: editingColor.value.set  // 添加合集属性
    })
    // 关闭编辑模式
    editingColor.value = null
    loadColors()
  } catch (error) {
    console.error('更新颜色失败:', error)
  }
}

// 取消编辑
const cancelEdit = () => {
  editingColor.value = null
}

// 按合集分组的计算属性
const groupedColors = computed(() => {
  const result = {}
  Object.entries(colors.value).forEach(([category, colorList]) => {
    result[category] = {}
    // 先按合集分组
    colorList.forEach(color => {
      const setName = color.set || '未分组'
      if (!result[category][setName]) {
        result[category][setName] = []
      }
      result[category][setName].push(color)
    })
  })
  return result
})

// 编辑格子图合集
const editPixelSet = async (setName, colors) => {
  editingColor.value = {
    category: 3,
    set: setName,
    newSet: setName,  // 添加新的合集名称字段
    colors: colors.map(color => ({
      id: color.id,
      name: color.name,
      code: color.code,
      set: setName  // 为每个颜色添加set信息
    }))
  }
}

// 保存格子图合集
const savePixelSet = async () => {
  if (!editingColor.value) return
  
  try {
    await axios.post('/color/update-set', {
      category: 3,
      oldSet: editingColor.value.set,
      newSet: editingColor.value.newSet,  // 发送新的合集名称
      colors: editingColor.value.colors.map(color => ({
        ...color,
        set: editingColor.value.newSet  // 更新所有颜色的set信息
      }))
    })
    
    // 关闭编辑模式
    editingColor.value = null
    // 重新加载颜色数据
    loadColors()
  } catch (error) {
    console.error('更新格子图合集失败:', error)
  }
}

// 删除格子图合集
const deletePixelSet = async (setName, category) => {
  if (await confirm(`确定要删除合集"${setName}"吗？`)) {
    try {
      // 获取该合集中所有颜色的ID
      const colorIds = groupedColors.value[category][setName].map(color => color.id)
      
      // 删除合集中的所有颜色
      await axios.post('/color/delete-set', {
        category: category,
        set: setName
      })
      
      // 更新本地数据
      loadColors()
    } catch (error) {
      console.error('删除合集失败:', error)
    }
  }
}

// 向合集添加新颜色
const addColorToSet = () => {
  if (editingColor.value) {
    editingColor.value.colors.push({
      id: null,
      code: '#000000',
      set: editingColor.value.newSet  // 使用新的合集名称
    })
  }
}

// 从合集中删除颜色
const removeColorFromSet = (index) => {
  if (editingColor.value && editingColor.value.colors.length > 1) {
    editingColor.value.colors.splice(index, 1)
  }
}

onMounted(() => {
  loadColors()
})
</script>

<template>
  <div class="color-manager">
    <!-- 添加新颜色表单 -->
    <div class="color-form" v-if="authStore.isAuthenticated">
      <div class="form-row">
        <div class="form-group">
          <label>分类：</label>
          <select v-model="newColor.category">
            <option :value="1">材料颜色</option>
            <option :value="2">标签颜色</option>
            <option :value="3">格子图颜色</option>
            <option :value="4">收藏颜色</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>颜色名称：</label>
          <input type="text" v-model="newColor.name" placeholder="输入颜色名称">
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>颜色代码：</label>
          <div class="color-input">
            <input type="color" v-model="newColor.code">
            <input type="text" v-model="newColor.code" placeholder="#000000">
          </div>
        </div>
      
        <div class="form-group">
          <label>颜色合集：</label>
          <input 
            type="text" 
            v-model="newColor.set" 
            placeholder="输入颜色合集名称（可选）">
        </div>
      </div>
      
      <button @click="addColor">添加颜色</button>
    </div>
    
    <!-- 颜色列表 - 按分类和合集展示 -->
    <div class="color-lists">
      <!-- 材料颜色 -->
      <div class="category-section">
        <h2>{{ getCategoryName(1) }}</h2>
        <div v-for="(setColors, setName) in groupedColors[1]" :key="setName" class="set-group">
          <h3 class="set-title">{{ setName }}</h3>
          <div class="material-color-grid">
            <div v-for="color in setColors" :key="color.id" 
              class="material-color-item"
              :class="{ 'editing': editingColor?.id === color.id }">
              <template v-if="!editingColor || editingColor.id !== color.id">
                <div class="color-preview large" :style="{ backgroundColor: color.code }"></div>
                <div class="color-info">
                  <span class="color-name">{{ color.name }}</span>
                  <span class="color-code">{{ color.code }}</span>
                </div>
                <div class="color-actions">
                  <button class="edit-btn" @click="startEdit(1, color)" v-if="authStore.isAuthenticated"><i class="iconfont icon-edit"></i></button>
                  <button class="delete-btn" @click="deleteColor(1, color.id)" v-if="authStore.isAuthenticated"><i class="iconfont icon-ashbin"></i></button>
                </div>
              </template>
              <template v-else>
                <!-- 编辑表单 -->
                <div class="edit-form">
                  <div class="form-group">
                    <input type="text" v-model="editingColor.name" placeholder="颜色名称">
                  </div>
                  <div class="form-group color-input">
                    <input type="color" v-model="editingColor.code">
                    <input type="text" v-model="editingColor.code">
                  </div>
                 
                  <div class="form-group">
                    <input 
                      type="text" 
                      v-model="editingColor.set" 
                      placeholder="颜色合集名称">
                  </div>
                  <div class="edit-actions">
                    <button class="save-btn" @click="saveEdit">保存</button>
                    <button class="cancel-btn" @click="cancelEdit">取消</button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 标签颜色 -->
      <div class="category-section">
        <h2>{{ getCategoryName(2) }}</h2>
        <div v-for="(setColors, setName) in groupedColors[2]" :key="setName" class="set-group">
          <h3 class="set-title">{{ setName }}</h3>
          <div class="tag-color-grid">
            <div v-for="color in setColors" :key="color.id" 
              class="tag-color-item"
              :class="{ 'editing': editingColor?.id === color.id }">
              <template v-if="!editingColor || editingColor.id !== color.id">
                <div class="tag-preview" :style="{ backgroundColor: color.code }">
                  {{ color.name }}
                </div>
                <div class="color-info">
                  <span class="color-code">{{ color.code }}</span>
                </div>
                <div class="color-actions">
                  <button class="edit-btn" @click="startEdit(2, color)" v-if="authStore.isAuthenticated"><i class="iconfont icon-edit"></i></button>
                  <button class="delete-btn" @click="deleteColor(2, color.id)" v-if="authStore.isAuthenticated"><i class="iconfont icon-ashbin"></i></button>
                </div>
              </template>
              <template v-else>
                <!-- 编辑表单 -->
                <div class="edit-form">
                  <div class="form-group">
                    <input type="text" v-model="editingColor.name" placeholder="颜色名称">
                  </div>
                  <div class="form-group color-input">
                    <input type="color" v-model="editingColor.code">
                    <input type="text" v-model="editingColor.code">
                  </div>
                 
                  <div class="form-group">
                    <input 
                      type="text" 
                      v-model="editingColor.set" 
                      placeholder="颜色合集名称">
                  </div>
                  <div class="edit-actions">
                    <button class="save-btn" @click="saveEdit">保存</button>
                    <button class="cancel-btn" @click="cancelEdit">取消</button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- 格子图颜色 -->
      <div class="category-section">
        <h2>{{ getCategoryName(3) }}</h2>
        <div v-for="(setColors, setName) in groupedColors[3]" :key="setName" class="set-group">
          <div class="pixel-set" :class="{ 'editing': editingColor?.set === setName }">
            <template v-if="editingColor?.set !== setName">
              <div class="set-header">
                <h3 class="set-title">{{ setName }}</h3>
                <div class="set-actions">
                  <button class="edit-btn" @click="editPixelSet(setName, setColors)" v-if="authStore.isAuthenticated">
                    <i class="iconfont icon-edit"></i>
                  </button>
                  <button class="delete-btn" @click="deletePixelSet(setName, 3)" v-if="authStore.isAuthenticated">
                    <i class="iconfont icon-ashbin"></i>
                  </button>
                </div>
              </div>
              <div class="pixels-container">
                <div v-for="color in setColors" :key="color.id" 
                  class="pixel"
                  :style="{ backgroundColor: color.code }"
                  :title="color.code">
                </div>
              </div>
            </template>
            <template v-else>
              <!-- 编辑表单 -->
              <div class="edit-form">
                <div class="form-group">
                  <label>合集名称：</label>
                  <input type="text" 
                    v-model="editingColor.newSet" 
                    placeholder="输入合集名称"
                    @keydown.enter.prevent>  <!-- 阻止回车键触发表单提交 -->
                </div>
                <!-- 颜色网格编辑 -->
                <div class="colors-edit-grid">
                  <div v-for="(color, index) in editingColor.colors" :key="index" class="color-edit-item">
                    <div class="color-edit-wrapper">
                      <input type="color" v-model="color.code" :title="color.code">
                      <input type="text" v-model="color.code" class="color-code-input">
                      <button class="delete-color-btn" @click="removeColorFromSet(index)" 
                        v-if="editingColor.colors.length > 1">
                        <i class="iconfont icon-ashbin"></i>
                      </button>
                    </div>
                  </div>
                  <!-- 添加新颜色按钮 -->
                  <div class="color-edit-item add-color" @click="addColorToSet">
                    <div class="add-button">
                      <i class="iconfont icon-add"></i>
                    </div>
                    <span>+</span>
                  </div>
                </div>
                <div class="edit-actions">
                  <button class="save-btn" @click="savePixelSet">保存</button>
                  <button class="cancel-btn" @click="cancelEdit">取消</button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 收藏颜色 -->
      <div class="category-section">
        <h2>{{ getCategoryName(4) }}</h2>
        <div v-for="(setColors, setName) in groupedColors[4]" :key="setName" class="set-group">
          <h3 class="set-title">{{ setName }}</h3>
          <div class="favorite-color-grid">
            <div v-for="color in setColors" :key="color.id" 
              class="favorite-color-item"
              :class="{ 'editing': editingColor?.id === color.id }">
              <template v-if="!editingColor || editingColor.id !== color.id">
                <div class="favorite-preview" :style="{ backgroundColor: color.code }"></div>
                <div class="color-info">
                  <span class="color-name">{{ color.name }}</span>
                  <span class="color-code">{{ color.code }}</span>
                </div>
                <div class="color-actions">
                  <button class="edit-btn" @click="startEdit(4, color)" v-if="authStore.isAuthenticated"><i class="iconfont icon-edit"></i></button>
                  <button class="delete-btn" @click="deleteColor(4, color.id)" v-if="authStore.isAuthenticated"><i class="iconfont icon-ashbin"></i></button>
                </div>
              </template>
              <template v-else>
                <!-- 编辑表单 -->
                <div class="edit-form">
                  <div class="form-group">
                    <input type="text" v-model="editingColor.name" placeholder="颜色名称">
                  </div>
                  <div class="form-group color-input">
                    <input type="color" v-model="editingColor.code">
                    <input type="text" v-model="editingColor.code">
                  </div>
                 
                  <div class="form-group">
                    <input 
                      type="text" 
                      v-model="editingColor.set" 
                      placeholder="颜色合集名称">
                  </div>
                  <div class="edit-actions">
                    <button class="save-btn" @click="saveEdit">保存</button>
                    <button class="cancel-btn" @click="cancelEdit">取消</button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-manager {
  padding: 20px;
}

.color-form {
  max-width: 800px;  /* 增加最大宽度 */
  margin: 20px 0;
  padding: 15px;  /* 减小内边距 */
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.form-group {
  flex: 1;
  margin-bottom: 0;  /* 移除底部边距，因为现在由form-row控制 */
}

.form-group label {
  display: block;
  margin-bottom: 4px;  /* 减小标签和输入框的间距 */
  font-size: 0.9em;  /* 稍微减小标签字体大小 */
}

.color-input {
  display: flex;
  gap: 8px;  /* 减小间距 */
}

.color-input input[type="color"] {
  width: 40px;  /* 减小颜色选择器宽度 */
  height: 34px;  /* 减小颜色选择器高度 */
  padding: 0;
}

.color-input input[type="text"] {
  flex: 1;
}

.color-lists {
  margin-top: 30px;
}

.category-section {
  margin-bottom: 30px;
}

.category-section h2 {
  font-size: 1em;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.color-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.color-preview {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.color-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 3px 0;
}

.color-name {
  font-weight: bold;
}

.color-code {
  font-size: 0.9em;
  color: #666;
}

.color-set {
  font-size: 0.8em;
  color: #666;
  font-style: italic;
}

.delete-btn {
  padding: 4px 4px;
  background: transparent;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

input, select {
  width: 100%;
  padding: 6px 8px;  /* 减小内边距 */
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.9em;  /* 稍微减小输入框字体大小 */
}

button {
  padding: 4px 8px;  /* 减小按钮内边距 */
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;  /* 稍微减小按钮字体大小 */
}

.color-actions {
  display: flex;
  gap: 8px;
}

.edit-btn {
  background-color: transparent;
  padding: 4px 8px;
  color: white;
  border: none;
  cursor: pointer;
}

.edit-form {
  width: 100%;
  padding: 10px;
}

.edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.edit-form .form-group {
  margin-bottom: 8px;
}

.edit-form input,
.edit-form select {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.set-group {
  margin-bottom: 20px;
}

.set-title {
  font-size: 0.9em;
  color: #666;
  margin: 10px 0 5px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--color-border);
}

/* 材料颜色样式 */
.material-color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 15px;
}

.material-color-item {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 10px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: all 0.3s ease;
}

/* 编辑状态样式 */
.material-color-item.editing {
  grid-column: span 2;  /* 横跨两列 */
  grid-row: span 2;     /* 横跨两行 */
  background-color: var(--color-background-soft);
  z-index: 1;
}

.material-color-item .edit-form {
  width: 100%;
  padding: 10px;
}

.material-color-item .edit-form .form-group {
  margin-bottom: 10px;
  text-align: left;
}

.material-color-item .edit-form label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.9em;
}

.material-color-item .edit-form .color-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.material-color-item .edit-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

/* 标签颜色样式 */
.tag-color-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-color-item {
  padding: 5px;
}

.tag-preview {
  padding: 2px 5px;
  border-radius: 5px;
  color: white;
  font-size: 0.9em;
}

/* 格子图颜色样式 */
.pixel-color-grid {
  margin: 10px 0;
}

.pixel-set {
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.pixels-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px;
  background: var(--color-background-mute);
  border-radius: 4px;
}

.pixel {
  width: 24px;
  height: 24px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
}

.pixel-color-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid var(--color-border-soft);
}

.pixel-color-actions:last-child {
  border-bottom: none;
}

.pixel-color-name {
  font-size: 0.9em;
  color: var(--color-text);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-buttons button {
  padding: 4px 8px;
  font-size: 0.8em;
}

/* 收藏颜色样式 */
.favorite-color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.favorite-color-item {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 8px;
}

.favorite-preview {
  height: 60px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.color-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.editing {
  background-color: var(--color-background-soft);
}

.set-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.set-actions {
  display: flex;
  gap: 8px;
}

.set-actions button {
  padding: 4px 8px;
  font-size: 0.8em;
  background: transparent;
}

.set-actions button:hover {
  background: var(--color-background-mute);
}

.pixel-set.editing {
  grid-column: span 2;
  grid-row: span 2;
}

.pixel-set .edit-form {
  padding: 15px;
}

.pixel-set .edit-form .form-group {
  margin-bottom: 15px;
}

.pixel-set .edit-form label {
  display: block;
  margin-bottom: 5px;
}

.pixel-set .edit-form .color-input {
  display: flex;
  gap: 8px;
}

.pixel-set .edit-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 15px;
}

.colors-edit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
  padding: 15px;
  background: var(--color-background-mute);
  border-radius: 8px;
  margin: 10px 0;
}

.color-edit-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.color-edit-item input[type="color"] {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
}

.color-edit-item .color-code-input {
  width: 80px;
  text-align: center;
  padding: 2px 4px;
  font-size: 0.8em;
}

.pixel-set.editing {
  grid-column: span 2;
  grid-row: span 2;
}

.pixels-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px;
  background: var(--color-background-mute);
  border-radius: 4px;
}

.pixel {
  width: 24px;
  height: 24px;
  border: 1px solid var(--color-border);
  border-radius: 2px;
}

.add-color {
  cursor: pointer;
  border: 2px dashed var(--color-border);
  border-radius: 8px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 80px;  /* 与其他颜色编辑项保持一致的高度 */
  transition: all 0.3s ease;
}

.add-color:hover {
  background: var(--color-background-soft);
  border-color: var(--color-border-hover);
}

.add-button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: var(--color-background-mute);
}

.add-color span {
  font-size: 0.8em;
  color: var(--color-text-light);
}

.add-color .iconfont {
  font-size: 24px;
  color: var(--color-text-light);
}

.color-edit-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.delete-color-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 50%;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.color-edit-wrapper:hover .delete-color-btn {
  opacity: 1;
}

.delete-color-btn:hover {
  background: var(--color-background-mute);
}

.delete-color-btn .iconfont {
  font-size: 12px;
  color: var(--color-text);
}

/* 确保颜色编辑项有足够的内边距来显示删除按钮 */
.color-edit-item {
  padding: 8px;
}
</style> 