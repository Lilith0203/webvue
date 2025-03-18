<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../api'

const typeTree = ref([])
const loading = ref(false)
const error = ref(null)
const expandedTypes = ref(new Set())

// 编辑状态
const editingType = ref(null)
const editForm = ref({ 
    id: null,
    typeName: '' 
})

// 新增状态
const isAddingType = ref(false)
const newTypeForm = ref({
  typeName: '',
  parentId: null
})

// 获取类型树
const fetchTypeTree = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await axios.get('/getMaterialType')
    typeTree.value = response.data.typetree
  } catch (err) {
    error.value = "获取类型数据失败：" + err.message
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}

// 切换展开状态
const toggleExpand = (typeId) => {
  if (expandedTypes.value.has(typeId)) {
    expandedTypes.value.delete(typeId)
  } else {
    expandedTypes.value.add(typeId)
  }
}

// 开始编辑
const startEdit = (type) => {
  editingType.value = type.id
  editForm.value = { 
    id: type.id,
    typeName: type.typeName 
  }
}

// 保存编辑
const saveEdit = async () => {
  try {
    await axios.post(`/updateMaterialType`, editForm.value)
    await fetchTypeTree() // 重新加载数据
    editingType.value = null
  } catch (err) {
    error.value = "保存失败：" + err.message
  }
}

// 取消编辑
const cancelEdit = () => {
  editingType.value = null
  editForm.value = { 
    id: null,
    typeName: '' 
  }
}

// 删除类型
const deleteType = async (typeId) => {
  if (!confirm('确定要删除此类型吗？')) return
  
  try {
    await axios.post(`/deleteMaterialType`, { id: typeId })
    await fetchTypeTree() // 重新加载数据
  } catch (err) {
    error.value = "删除失败：" + err.message
  }
}

// 添加新类型
const addType = async () => {
  try {
    await axios.post('/addMaterialType', newTypeForm.value)
    await fetchTypeTree() // 重新加载数据
    isAddingType.value = false
    newTypeForm.value = { typeName: '', parentId: null }
  } catch (err) {
    error.value = "添加失败：" + err.message
  }
}

onMounted(() => {
  fetchTypeTree()
})
</script>

<template>
  <div class="type-manager">
    <!-- 错误提示 -->
    <div v-if="error" class="error">{{ error }}</div>
    
    <!-- 加载提示 -->
    <div v-if="loading" class="loading">加载中...</div>
    
    <!-- 添加新类型按钮 -->
    <button class="add-button" @click="isAddingType = true">
      添加新类型
    </button>
    
    <!-- 新增类型表单 -->
    <div v-if="isAddingType" class="add-form">
      <input 
        v-model="newTypeForm.typeName"
        placeholder="输入类型名称">
      <select v-model="newTypeForm.parentId">
        <option :value="null">一级类型</option>
        <option 
          v-for="type in typeTree" 
          :key="type.id"
          :value="type.id">
          {{ type.typeName }}
        </option>
      </select>
      <button @click="addType">√</button>
      <button @click="isAddingType = false">x</button>
    </div>
    
    <!-- 类型树 -->
    <div class="type-tree">
      <template v-for="type in typeTree" :key="type.id">
        <div class="type-item">
          <!-- 展开/收起箭头 -->
          <span 
            v-if="type.children?.length"
            class="expand-arrow"
            @click="toggleExpand(type.id)">
            {{ expandedTypes.has(type.id) ? '▼' : '▶' }}
          </span>
          <span v-else class="expand-placeholder"></span>
          
          <!-- 类型名称/编辑框 -->
          <template v-if="editingType === type.id">
            <input 
              v-model="editForm.typeName"
              @keyup.enter="saveEdit"
              @keyup.esc="cancelEdit">
            <button @click="saveEdit">保存</button>
            <button @click="cancelEdit">取消</button>
          </template>
          <template v-else>
            <span class="type-name">{{ type.typeName }}</span>
            <div class="actions">
              <button @click="startEdit(type)">编辑</button>
              <button @click="deleteType(type.id)">删除</button>
            </div>
          </template>
        </div>
        
        <!-- 子类型 -->
        <div 
          v-if="type.children?.length && expandedTypes.has(type.id)"
          class="children"
          :style="{ paddingLeft: '20px' }">
          <div 
            v-for="child in type.children"
            :key="child.id"
            class="type-item">
            <template v-if="editingType === child.id">
              <input 
                v-model="editForm.typeName"
                @keyup.enter="saveEdit"
                @keyup.esc="cancelEdit">
              <button @click="saveEdit">保存</button>
              <button @click="cancelEdit">取消</button>
            </template>
            <template v-else>
              <span class="type-name">{{ child.typeName }}</span>
              <div class="actions">
                <button @click="startEdit(child)">编辑</button>
                <button @click="deleteType(child.id)">删除</button>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.type-manager {
  padding: 10px 10px;
  max-width: 800px;
  margin: 0 auto;
  font-size: 13px;
}

.a-back {
  display: block;
  font-size: 0.8em;
  line-height: 2em;
}

.add-button {
  margin: 10px 0;
  padding: 5px 10px;
  background-color: #409EFF;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.8em;
  cursor: pointer;
}

.add-form {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.add-form input, .add-form select {
  max-width: 100px;
  font-size: 12px;
}

.type-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
  gap: 10px;
}

.children .type-item {
  padding-left: 30px;
}

.expand-arrow {
  cursor: pointer;
  user-select: none;
  width: 20px;
  color: #666;
}

.expand-placeholder {
  width: 20px;
}

.type-name {
  flex: 1;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  padding: 3px 6px;
  background-color: #f4f4f5;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.actions button:hover {
  background-color: #ecf5ff;
}

.error {
  color: #f56c6c;
  margin-bottom: 15px;
}

.loading {
  color: #909399;
  margin-bottom: 15px;
}

input {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

select {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

@media (min-width: 1024px) {
  .type-manager {
    margin: 100px auto 120px;
  }
}
</style>