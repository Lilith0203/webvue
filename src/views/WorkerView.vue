<script setup>
import axios from '../api'

import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const route = useRoute()
const materialData = ref(null)
const loading = ref(false)
const error = ref(null)
const editingRow = ref(null) // 新增：跟踪正在编辑的行
const editForm = ref({}) // 新增：存储编辑的临时数据
//类型树数据
const typeTree = ref([])
const typeMap = ref(new Map()) // 存储id和typeName的映射

// 获取类型树数据
const fetchTypeTree = async () => {
  try {
    const response = await axios.get('/getMaterialType')
    typeTree.value = response.data.typetree
    // 构建id和typeName的映射
    buildTypeMap(typeTree.value)
  } catch (err) {
    error.value = "获取类型数据失败：" + err.message
  }
}

// 递归构建类型映射
const buildTypeMap = (types, parentName = '') => {
  types.forEach(type => {
    const fullName = parentName ? `${parentName} / ${type.typeName}` : type.typeName
    typeMap.value.set(type.id, fullName)
    if (type.children && type.children.length > 0) {
      buildTypeMap(type.children, fullName)
    }
  })
}

// 递归构建选项
const buildTypeOptions = (types, level = 0, result = []) => {
    types.forEach(type => {
    // 添加当前选项
    result.push({
      value: type.id,
      label: '　'.repeat(level) + type.typeName, // 使用全角空格进行缩进
      level: level
    })
    // 递归处理子选项
    if (type.children && type.children.length > 0) {
      buildTypeOptions(type.children, level + 1, result)
    }
  })
  return result
}

// 计算属性：类型选项列表
const typeOptions = computed(() => {
  return buildTypeOptions(typeTree.value)
})

// 字段配置
const columns = {
  id: { label: 'ID', editable: false },
  name: { label: '名称', editable: true },
  type: { label: '类型', editable: true },
  substance: { label: '材质', editable: true },
  size: { label: '尺寸', editable: true },
  shape: { label: '形状', editable: true },
  color: { label: '颜色', editable: true },
  price: { label: '价格', editable: true },
  stock: { label: '库存', editable: true },
  shop: { label: '商店', editable: true },
  note: { label: '备注', editable: true },
  link: { label: '链接', editable: true, type: 'url' },
  pic: { label: '图片', editable: true, type: 'url' },
  actions: { label: '操作', editable: false }
}

const isAddingMaterial = ref(false)
const newMaterialForm = ref({
  name: '',
  type: '',
  substance: '',
  size: '',
  shape: '',
  color: '',
  price: '',
  stock: '',
  shop: '',
  note: '',
  link: '',
  pic: ''
})

// 重置表单
const resetForm = () => {
  newMaterialForm.value = {
    name: '',
    type: '',
    substance: '',
    size: '',
    shape: '',
    color: '',
    price: 0,
    stock: 0,
    shop: '',
    note: '',
    link: '',
    pic: ''
  }
}

// 列显示设置
const visibleColumns = ref(Object.keys(columns)) // 默认显示所有列
const isColumnSettingsVisible = ref(false)

// 切换列显示状态
const toggleColumn = (columnKey) => {
  const index = visibleColumns.value.indexOf(columnKey)
  if (index === -1) {
    visibleColumns.value.push(columnKey)
  } else {
    // 确保至少保留一列
    if (visibleColumns.value.length > 1) {
      visibleColumns.value.splice(index, 1)
    }
  }
}

// 计算当前可见的列
const visibleColumnsConfig = computed(() => {
  return Object.fromEntries(
    Object.entries(columns).filter(([key]) => 
      visibleColumns.value.includes(key)
    )
  )
})

// 保存列设置到 localStorage
const saveColumnSettings = () => {
  localStorage.setItem('materialTableColumns', JSON.stringify(visibleColumns.value))
}

// 从 localStorage 加载列设置
const loadColumnSettings = () => {
  const saved = localStorage.getItem('materialTableColumns')
  if (saved) {
    visibleColumns.value = JSON.parse(saved)
  }
}

//判断是否有编辑权限
const canEdit = computed(() => {
    return authStore.isAuthenticated
})

const startEdit = (row) => {
    if (!canEdit.value) return
  editingRow.value = row.id
  editForm.value = { ...row }
}

const cancelEdit = () => {
  editingRow.value = null
  editForm.value = {}
}

const fetchMaterialData = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await axios.post(`/material`)
    materialData.value = response.data.materials
  } catch (err) {
    error.value = "获取数据失败：" + err.message
  } finally {
    loading.value = false
  }
}

const updateMaterialItem = async (row) => {
    if (!canEdit.value) return
    try {
        loading.value = true
        await axios.post(`/updateMaterial`, editForm.value)
        await fetchMaterialData() // 刷新数据
        editingRow.value = null
        editForm.value = {}
    } catch (err) {
        error.value = "更新失败：" + err.message
    } finally {
        loading.value = false
    }
}

// 添加新材料
const addMaterial = async () => {
  if (!canEdit.value) return
  try {
    loading.value = true
    await axios.post('/addMaterial', newMaterialForm.value)
    await fetchMaterialData() // 刷新数据
    isAddingMaterial.value = false
    resetForm()
  } catch (err) {
    error.value = "添加失败：" + err.message
  } finally {
    loading.value = false
  }
}

// 添加删除方法
const deleteMaterial = async (row) => {
  if (!canEdit.value) return
  
  // 添加确认提示
  if (!confirm('确定要删除这条记录吗？')) {
    return
  }

  try {
    loading.value = true
    await axios.post('/deleteMaterial', { id: row.id })
    await fetchMaterialData() // 刷新数据
  } catch (err) {
    error.value = "删除失败：" + err.message
  } finally {
    loading.value = false
  }
}

onMounted(async() => {
    loadColumnSettings()
    await fetchTypeTree()
    await fetchMaterialData()
})

// 修改表格显示逻辑，显示类型名称而不是ID
const getTypeName = (typeId) => {
  return typeMap.value.get(typeId) || typeId
}
</script>

<template>
    <!-- 列设置按钮和下拉菜单 -->
    <div class="table-controls">
      <div class="column-settings">
        <button 
          class="settings-btn"
          @click="isColumnSettingsVisible = !isColumnSettingsVisible"
        >
          列设置
        </button>
        <div 
          v-if="isColumnSettingsVisible" 
          class="column-dropdown"
        >
          <div class="column-options">
            <label 
              v-for="(config, key) in columns" 
              :key="key"
              class="column-option"
            >
              <input
                type="checkbox"
                :checked="visibleColumns.includes(key)"
                @change="toggleColumn(key)"
              >
              {{ config.label }}
            </label>
          </div>
          <button 
            class="save-settings-btn"
            @click="saveColumnSettings(); isColumnSettingsVisible = false"
          >
            保存设置
          </button>
        </div>
      </div>

      <!-- 添加新材料按钮 -->
      <div v-if="canEdit" class="add-material">
        <button 
          class="add-btn"
          @click="isAddingMaterial = true"
        >
          新增
        </button>
      </div>
    </div>

    <!-- 新增材料表单 -->
    <div v-if="isAddingMaterial" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>新增材料</h3>
          <button 
            class="close-btn"
            @click="isAddingMaterial = false"
          >
            ×
          </button>
        </div>
        
        <div class="form-grid">
          <div v-for="(config, key) in columns" :key="key" class="form-item">
            <template v-if="key !== 'id'">
              <label v-if="key !== 'actions'">{{ config.label }}</label>
              <template v-if="key === 'type'">
                <select 
                    v-model="newMaterialForm[key]"
                    class="form-select"
                    >
                    <option value="">请选择类型</option>
                    <option 
                        v-for="option in typeOptions" 
                        :key="option.value"
                        :value="option.value"
                        :style="{ 
                        paddingLeft: `${option.level * 1.5}em`,
                        backgroundColor: option.level % 2 ? '#f9f9f9' : 'white'
                        }"
                    >
                        {{ option.label }}
                    </option>
                </select>
              </template>
              <template v-else-if="config.type === 'number'">
                <input
                  v-model.number="newMaterialForm[key]"
                  type="number"
                  class="form-input"
                >
              </template>
              <template v-else-if="key !== 'actions'">
                <input
                  v-model="newMaterialForm[key]"
                  :type="config.type || 'text'"
                  class="form-input"
                >
              </template>
            </template>
          </div>
        </div>
        
        <div class="form-actions">
          <button class="save-btn" @click="addMaterial">保存</button>
          <button class="cancel-btn" @click="isAddingMaterial = false">取消</button>
        </div>
      </div>
    </div>

<div class="material-table">

    <div class="material-table-header">
        <div v-if="loading">加载中...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else>
            <table>
                <thead>
                    <tr>
                        <th v-for="(config, key) in visibleColumnsConfig" :key="key">
                            {{ config.label }}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in materialData" :key="row.id">
                        <!-- 显示模式 -->
                        <template v-if="editingRow !== row.id">
                            <td v-for="(config, key) in visibleColumnsConfig" :key="key">
                                <!-- 如果是操作列 -->
                                <template v-if="key === 'type'">
                                    {{ getTypeName(row[key]) }}
                                </template>
                                <template v-else-if="key === 'actions' && canEdit">
                                <div class="action-buttons">
                                    <button class="edit-btn" @click="startEdit(row)">编辑</button>
                                    <button class="delete-btn" @click="deleteMaterial(row)">删除</button>
                                </div>
                                </template>
                                <!-- 其他列的显示逻辑 -->
                                <template v-else>
                                <template v-if="key === 'link' || key === 'pic'">
                                    <a v-if="row[key]" :href="row[key]" target="_blank">查看</a>
                                </template>
                                <template v-else>
                                    {{ row[key] }}
                                </template>
                            </template>
                            </td>
                        </template>

                        <!-- 编辑模式 -->
                        <template v-else>
                            <td v-for="(config, key) in visibleColumnsConfig" :key="key">
                                <!-- 在表格显示中使用类型名称 -->
                                <template v-if="key === 'type'">
                                    <select 
                                        v-model="editForm[key]"
                                        class="form-select"
                                        >
                                        <option value="">请选择类型</option>
                                        <option 
                                            v-for="option in typeOptions" 
                                            :key="option.value"
                                            :value="option.value"
                                            :style="{ 
                                            paddingLeft: `${option.level * 1.5}em`,
                                            backgroundColor: option.level % 2 ? '#f9f9f9' : 'white'
                                            }"
                                        >
                                            {{ option.label }}
                                        </option>
                                    </select>
                                </template>
                                
                                <!-- 如果是操作列 -->
                                <template v-else-if="key === 'actions'">
                                <div class="action-buttons">
                                    <button class="save-btn" @click="updateMaterialItem(row)">保存</button>
                                    <button class="cancel-btn" @click="cancelEdit">取消</button>
                                </div>
                                </template>
                                
                                <template v-else-if="config.editable">
                                    <input
                                        v-if="config.type === 'number'"
                                        v-model.number="editForm[key]"
                                        type="number"
                                        class="form-input"
                                    >
                                    <input
                                        v-else
                                        v-model="editForm[key]"
                                        :type="config.type || 'text'"
                                        class="form-input"
                                    >
                                </template>
                                <template v-else>
                                    {{ editForm[key] }}
                                </template>
                            </td>
                        </template>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</div>
</template>

<style scoped>
.material-table {
    font-size: 12px;
  margin: 20px 0;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

th, td {
  border: 1px solid #ddd;
  padding: 5px;
  text-align: left;
  max-width: 100px;
  white-space: normal; /* 允许文本换行 */
  word-wrap: break-word; /* 允许长单词断行 */
  word-break: break-all; /* 允许在任意字符间断行 */
}

th {
  background-color: #f2f2f2;
  font-weight: bold;
}

tr:nth-child(even) {
  background-color: #f9f9f9;
}

tr:hover {
  background-color: #f5f5f5;
}

.form-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-textarea {
  width: 100%;
  min-height: 60px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.action-buttons {
  white-space: nowrap;
  display: flex;
  /*gap: 4px; *//* 按钮之间的间距 */
}

button {
  padding: 4px 8px;
  margin: 0 4px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.edit-btn {
    font-size: 12px;
  background-color: #4CAF50;
  color: white;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn {
    font-size: 12px;
  background-color: #f44336; /* 红色 */
  color: white;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.edit-btn:hover,
.delete-btn:hover {
  opacity: 0.8;
}

.delete-btn:hover {
  background-color: #d32f2f; /* 更深的红色 */
}

button:hover {
  opacity: 0.8;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.error {
  color: #f44336;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #f44336;
  border-radius: 4px;
}

a {
  color: #2196F3;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

.table-controls {
    margin-top: 15px;
  display: flex;
  justify-content: flex-start;
}

.column-settings {
  position: relative;
}

.settings-btn {
    font-size: 12px;
  background-color: #666;
  color: white;
}

.column-dropdown {
  position: absolute;
  left: 0;
  top: 100%;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 1000;
  min-width: 200px;
}

.column-options {
  max-height: 300px;
  overflow-y: auto;
}

.column-option {
  display: block;
  padding: 4px 0;
  cursor: pointer;
}

.column-option:hover {
  background-color: #f5f5f5;
}

.column-option input {
  margin-right: 8px;
}

.save-settings-btn {
  margin-top: 1rem;
  width: 100%;
  background-color: #4CAF50;
  color: white;
}

/* 确保下拉菜单在滚动时保持可见 */
.material-table {
  position: relative;
}

.table-controls {
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between; /* 修改为两端对齐 */
  align-items: center;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 4px;
  padding: 20px;
  width: 80%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  color: #666;
}

.close-btn:hover {
  color: #000;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
}

.form-item label {
  margin-bottom: 4px;
  font-size: 12px;
  color: #666;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.form-textarea {
  min-height: 60px;
  resize: vertical;
}

/* 按钮样式 */
.add-btn {
  background-color: #4CAF50;
  color: white;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn {
    font-size: 12px;
  background-color: #4CAF50;
  color: white;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
}

.cancel-btn {
    font-size: 12px;
  background-color: #f44336;
  color: white;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
}

.form-select {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background-color: white;
}

/* 可选：美化下拉选项的缩进 */
.form-select option {
    padding: 4px 8px;
  font-size: 12px;
}

/* 可选：添加hover效果 */
.form-select option:hover {
  background-color: #e6f7ff;
}

th:last-child,
td:last-child {
    width: 80px;
}

@media (min-width: 1024px) {
    .material-table {
        font-size: 14px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        min-width: 800px;
    }

    .modal-content {
    width: 20%;
    padding: 15px;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>