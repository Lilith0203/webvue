<script setup>
import axios from '../api'
import ImagePreview from '../components/ImagePreview.vue'
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const materialData = ref(null)
const loading = ref(false)
const error = ref(null)
const editingRow = ref(null) // 新增：跟踪正在编辑的行
const editForm = ref({}) // 新增：存储编辑的临时数据
//类型树数据
const typeTree = ref([])
const typeMap = ref(new Map()) // 存储id和typeName的映射
const displayLimit = ref(50) 
// 文件上传相关的状态
const fileInput = ref(null)
const uploadProgress = ref(0)
const uploadError = ref(null)
// 图片预览状态
const previewVisible = ref(false)
const previewImage = ref('')
const previewTitle = ref('')

// 添加新的状态
const showOutOfStock = ref(false)

// 显示图片预览
const showImagePreview = (url, name) => {
  previewImage.value = url
  previewTitle.value = name
  previewVisible.value = true
}

// 关闭图片预览
const closePreview = () => {
  previewVisible.value = false
  previewImage.value = ''
  previewTitle.value = ''
}

// 触发文件选择
const triggerFileInput = (rowId) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.display = 'none'
  
  input.onchange = (event) => handleFileUpload(event, rowId)
  
  document.body.appendChild(input)
  input.click()
  document.body.removeChild(input)
}

// 处理文件上传
const handleFileUpload = async (event, rowId) => {
  const file = event.target.files[0]
  if (!file) return

  // 检查文件类型和大小
  if (!file.type.startsWith('image/')) {
    uploadError.value = '请选择图片文件'
    return
  }

  if (file.size > 5 * 1024 * 1024) { // 5MB 限制
    uploadError.value = '图片大小不能超过5MB'
    return
  }

  try {
    uploadError.value = null
    uploadProgress.value = 0

    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'material');
    const response = await axios.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        uploadProgress.value = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
      }
    })

    // 更新编辑表单中的图片URL
    if (editForm.value && editingRow.value === rowId) {
      editForm.value.pic = response.data.url
    }
    uploadProgress.value = 0
  } catch (error) {
    uploadError.value = '上传失败：' + (error.response?.data?.message || error.message)
  }
}

// 图片预览
const openImageViewer = (url) => {
  if (url) {
    window.open(url, '_blank')
  }
}

// 计算当前显示的材料
const displayedMaterials = computed(() => {
  if (!materialData.value) return []
  // 先应用搜索过滤
  const filtered = materialData.value.filter(item => {
    return (
      (!searchForm.value.name || item.name.toLowerCase().includes(searchForm.value.name.toLowerCase())) &&
      (!searchForm.value.type.length || searchForm.value.type.includes(item.type)) &&
      (!searchForm.value.substance || item.substance.toLowerCase().includes(searchForm.value.substance.toLowerCase())) &&
      (!searchForm.value.shape || item.shape.toLowerCase().includes(searchForm.value.shape.toLowerCase())) &&
      (!searchForm.value.color || item.color.toLowerCase().includes(searchForm.value.color.toLowerCase()))
    )
  })

  // 然后限制显示数量
  return filtered.slice(0, displayLimit.value)
})

// 是否还有更多材料可以显示
const hasMore = computed(() => {
  if (!materialData.value) return false
  
  const filteredCount = materialData.value.filter(item => {
    return (
      (!searchForm.value.name || item.name.toLowerCase().includes(searchForm.value.name.toLowerCase())) &&
      (!searchForm.value.type.length || searchForm.value.type.includes(item.type)) &&
      (!searchForm.value.substance || item.substance.toLowerCase().includes(searchForm.value.substance.toLowerCase())) &&
      (!searchForm.value.shape || item.shape.toLowerCase().includes(searchForm.value.shape.toLowerCase())) &&
      (!searchForm.value.color || item.color.toLowerCase().includes(searchForm.value.color.toLowerCase()))
    )
  }).length
  
  return filteredCount > displayLimit.value
})

// 显示更多材料
const loadMore = () => {
  displayLimit.value += 50  // 每次增加50条
}

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
    const fullName = parentName ? `${parentName} - ${type.typeName}` : type.typeName
    typeMap.value.set(type.id, fullName)
    if (type.children && type.children.length > 0) {
      buildTypeMap(type.children, fullName)
    }
  })
}

// 修改类型选项的构建方法，添加路径信息
const buildTypeOptions = (types, parentPath = '', level = 0) => {
  if (!types) return []
  
  return types.flatMap(type => {
    const currentPath = parentPath ? `${parentPath}/${type.id}` : `${type.id}`
    const option = {
      value: type.id,
      label: type.typeName,
      level,
      path: currentPath
    }
    
    if (type.children && type.children.length > 0) {
      return [option, ...buildTypeOptions(type.children, currentPath, level + 1)]
    }
    
    return [option]
  })
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
    price: '',
    stock: '',
    shop: '',
    note: '',
    link: ''
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
  } else {
    // 设置默认显示的列
    visibleColumns.value = [
      'name',
      'type',
      'substance',
      'size',
      'shape',
      'color',
      'stock',
    ]
  }
}

//搜索条件
const searchForm = ref({
  name: '',
  type: [], // 类型多选
  substance: '',
  shape: '',
  color: ''
})

// 重置搜索条件
const resetSearch = () => {
  searchForm.value = {
    name: '',
    type: [],
    substance: '',
    shape: '',
    color: ''
  }
  displayLimit.value = 50  // 重置显示数量
}

// 类型选择相关状态
const showTypeDropdown = ref(false)
const selectedTypes = computed(() => {
  // 获取所有选中的类型
  const selectedIds = searchForm.value.type
  
  // 过滤出没有选中父类型的选中类型
  const topLevelSelected = selectedIds.filter(id => {
    const option = typeOptions.value.find(opt => opt.value === id)
    if (!option) return false
    
    // 如果是一级类型，或者其父类型未被选中，则显示
    const parentPath = option.path.split('/').slice(0, -1).join('/')
    const parentOption = typeOptions.value.find(opt => opt.path === parentPath)
    return !parentOption || !selectedIds.includes(parentOption.value)
  })
  
  // 转换为类型名称
  return topLevelSelected.map(id => getTypeName(id)).join(', ')
})

// 点击外部关闭下拉框
const typeDropdownRef = ref(null)

onMounted(() => {
  document.addEventListener('click', (e) => {
    if (typeDropdownRef.value && !typeDropdownRef.value.contains(e.target)) {
      showTypeDropdown.value = false
    }
  })
})

// 跟踪展开的菜单项
const expandedTypes = ref(new Set())

// 切换展开状态
const toggleExpand = (typeId) => {
  if (expandedTypes.value.has(typeId)) {
    expandedTypes.value.delete(typeId)
  } else {
    expandedTypes.value.add(typeId)
  }
}

// 判断是否有子项
const hasChildren = (option) => {
  return typeOptions.value.some(item => 
    item.level === option.level + 1 && 
    item.path.startsWith(option.path + '/')
  )
}

// 修改显示条件的判断
const isVisible = (option) => {
  if (option.level === 0) return true
  
  const parentPath = option.path.split('/').slice(0, -1).join('/')
  return expandedTypes.value.has(parentPath)
}

// 获取所有子类型ID
const getChildTypeIds = (option) => {
  return typeOptions.value
    .filter(item => item.path.startsWith(option.path + '/'))
    .map(item => item.value)
}

// 获取父类型ID
const getParentTypeId = (option) => {
  const parentPath = option.path.split('/').slice(0, -1).join('/')
  return typeOptions.value.find(item => item.path === parentPath)?.value
}

// 修改切换选中状态的逻辑
const toggleType = (option) => {
  const typeId = option.value
  const index = searchForm.value.type.indexOf(typeId)
  
  if (index === -1) {
    // 选中当前类型
    const typesToAdd = [typeId]
    
    // 如果是一级类型，添加所有子类型
    if (option.level === 0) {
      typesToAdd.push(...getChildTypeIds(option))
      // 自动展开
      expandedTypes.value.add(option.path)
    } else {
      // 如果选中所有同级类型，也选中父类型
      const parentId = getParentTypeId(option)
      const siblings = typeOptions.value.filter(item => {
      const itemParentPath = item.path.split('/').slice(0, -1).join('/')
      return itemParentPath === option.path.split('/').slice(0, -1).join('/')
    })
      
    const allSiblingsSelected = siblings.every(sibling => 
      searchForm.value.type.includes(sibling.value) || sibling.value === typeId
    )
      
    if (allSiblingsSelected && parentId) {
      typesToAdd.push(parentId)
    }
  }
    
  searchForm.value.type = [...new Set([...searchForm.value.type, ...typesToAdd])]
  } else {
    // 取消选中当前类型
    const typesToRemove = [typeId]
    
    // 如果是一级类型，移除所有子类型
    if (option.level === 0) {
      typesToRemove.push(...getChildTypeIds(option))
    } else {
      // 如果取消选中子类型，也取消选中父类型
      const parentId = getParentTypeId(option)
      if (parentId) {
        typesToRemove.push(parentId)
      }
    }
    
    searchForm.value.type = searchForm.value.type.filter(id => !typesToRemove.includes(id))
  }
}

// 控制下拉框显示
const isTypeDropdownVisible = ref(false)
const isEditTypeDropdownVisible = ref(false)

// 选择类型
const selectType = (value, mode) => {
  if (mode === 'new') {
    newMaterialForm.value.type = value
    isTypeDropdownVisible.value = false
  } else if (mode === 'edit') {
    editForm.value.type = value
    isEditTypeDropdownVisible.value = false
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

// 修改获取材料数据的方法
const fetchMaterialData = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await axios.post(`/material`, {
      showAll: showOutOfStock.value // 添加参数控制是否显示所有材料
    })
    materialData.value = response.data.materials
  } catch (err) {
    error.value = "获取数据失败：" + err.message
  } finally {
    loading.value = false
  }
}

// 监听 showOutOfStock 变化，重新获取材料
watch(showOutOfStock, () => {
  fetchMaterialData()
})

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

  // 重置错误
  formErrors.value = {}
  // 验证颜色字段
  if (!newMaterialForm.value.color) {
    formErrors.value.color = '请输入颜色'
    return
  }

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

// 添加表单错误状态
const formErrors = ref({})

onMounted(async() => {
  document.addEventListener('click', (e) => {
    const target = e.target
    if (!target.closest('.type-selector')) {
      isTypeDropdownVisible.value = false
      isEditTypeDropdownVisible.value = false
    }
  })
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
  <div class="content-wrapper">
    <!-- 列设置按钮和下拉菜单 -->
    <div class="table-controls">
      <div class="column-settings">
        <button 
          class="settings-btn"
          @click="isColumnSettingsVisible = !isColumnSettingsVisible">
          列设置
        </button>
        <RouterLink 
          v-if="canEdit"
          to="/material/type"
          class="settings-btn">
          分类管理
        </RouterLink>
        <div 
          v-if="isColumnSettingsVisible" 
          class="column-dropdown">
          <div class="column-options">
            <label 
              v-for="(config, key) in columns" 
              :key="key"
              class="column-option">
              <input
                type="checkbox"
                :checked="visibleColumns.includes(key)"
                @change="toggleColumn(key)">
              {{ config.label }}
            </label>
          </div>
          <button 
            class="save-settings-btn"
            @click="saveColumnSettings(); isColumnSettingsVisible = false">
            保存设置
          </button>
        </div>
      </div>

      <!-- 添加新材料按钮 -->
      <div v-if="canEdit" class="add-material">
        <button 
          class="add-btn"
          @click="isAddingMaterial = true">
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
            @click="isAddingMaterial = false">
            ×
          </button>
        </div>
        
        <div class="form-grid">
          <div v-for="(config, key) in columns" :key="key" class="form-item"
            :style="{display: key!=='pic'?'block':'none'}">
            <template v-if="key !== 'id'">
              <label v-if="key !== 'actions'">{{ config.label }}</label>
              <template v-if="key === 'type'">
                <div class="type-selector">
                  <div 
                    class="type-input" 
                    @click="isTypeDropdownVisible = !isTypeDropdownVisible">
                    <span v-if="newMaterialForm[key]">{{ getTypeName(newMaterialForm[key]) }}</span>
                    <span v-else class="placeholder">请选择类型</span>
                    <span class="arrow">▼</span>
                  </div>

                  <div 
                    v-show="isTypeDropdownVisible" 
                    class="type-dropdown">
                    <div 
                      v-for="option in typeOptions" 
                      :key="option.value"
                      v-show="isVisible(option)"
                      class="type-option"
                      :class="{ 
                        'selected': newMaterialForm[key] === option.value,
                        [`level-${option.level}`]: true
                      }"
                      :style="{ paddingLeft: `${option.level * 20 + 10}px` }">
                      <!-- 展开/收起箭头 -->
                      <span 
                        v-if="hasChildren(option)"
                        class="expand-arrow"
                        @click.stop="toggleExpand(option.path)">
                        {{ expandedTypes.has(option.path) ? '▼' : '▶' }}
                      </span>
                      <span v-else class="expand-placeholder"></span>
                      
                      <!-- 选项内容 -->
                      <div class="type-content" @click.stop="selectType(option.value, 'new')">
                        <span>{{ option.label }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else-if="config.type === 'number'">
                <input
                  v-model.number="newMaterialForm[key]"
                  type="number"
                  class="form-input">
              </template>
              <template v-else-if="key == 'color'">
                <input
                  v-model="newMaterialForm[key]"
                  :type="text"
                  class="form-input"
                  required 
                  :class="{ 'error': formErrors.color }"  
                  placeholder="请输入颜色">
                <!-- 显示错误信息 -->
                <span v-if="formErrors.color" class="error-text">{{ formErrors.color }}</span>
              </template>
              <template v-else-if="key !== 'actions'">
                <input
                  v-model="newMaterialForm[key]"
                  :type="config.type || 'text'"
                  class="form-input">
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

    <!-- 搜索表单 -->
    <div class="search-form">
      <div class="search-item">
        <label>名称：</label>
        <input 
          v-model="searchForm.name"
          type="text"
          placeholder="请输入名称">
      </div>
      
      <div class="search-item" ref="typeDropdownRef">
        <label>类型：</label>
        <div class="type-selector">
          <div 
            class="type-input" 
            @click="showTypeDropdown = !showTypeDropdown">
            <span v-if="searchForm.type.length">{{ selectedTypes }}</span>
            <span v-else class="placeholder">请选择类型</span>
            <span class="arrow">▼</span>
          </div>

          <!-- 类型下拉菜单 -->
          <div 
            v-show="showTypeDropdown" 
            class="type-dropdown">
            <div 
              v-for="option in typeOptions" 
              :key="option.value"
              v-show="option.level === 0 || isVisible(option)"
                class="type-option"
                :class="{ 
                  'selected': searchForm.type.includes(option.value),
                  [`level-${option.level}`]: true
                }"
                :style="{ paddingLeft: `${option.level * 20 + 10}px` }">
              <!-- 展开/收起箭头 -->
              <span 
                v-if="hasChildren(option)"
                class="expand-arrow"
                @click.stop="toggleExpand(option.path)">
                  {{ expandedTypes.has(option.path) ? '▼' : '▶' }}
              </span>
              <!-- 复选框和标签 -->
              <div class="type-content" @click.stop="toggleType(option)">
                <span>{{ option.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="search-item">
        <label>材质：</label>
        <input 
          v-model="searchForm.substance"
          type="text"
          placeholder="请输入材质">
      </div>
      
      <div class="search-item">
        <label>形状：</label>
        <input 
          v-model="searchForm.shape"
          type="text"
          placeholder="请输入形状">
      </div>
      
      <div class="search-item">
        <label>颜色：</label>
        <input 
          v-model="searchForm.color"
          type="text"
          placeholder="请输入颜色">
      </div>
      
      <div class="search-actions">
        <label class="stock-toggle">
          <input type="checkbox" v-model="showOutOfStock">
          <span>显示无库存材料</span>
        </label>
        <button class="reset-btn" @click="resetSearch">重置</button>
      </div>
    </div>

    <div class="material-table">

      <div class="material-table-header">
        <div v-if="loading">加载中...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else class="table-wrapper">
          <table v-if="displayedMaterials.length">
            <thead>
              <tr>
                <th v-for="(config, key) in visibleColumnsConfig" :key="key">
                  {{ config.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in displayedMaterials" :key="row.id">
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
                      <template v-if="key === 'link'">
                        <a v-if="row[key]" :href="row[key]" target="_blank">查看</a>
                      </template>
                      <template v-else-if="key === 'pic'">
                        <div class="pic-preview" @click="showImagePreview(row.pic, row.name)">
                          <a v-if="row.pic">查看</a>
                        </div>
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
                    <template v-if="key === 'type' && editingRow === row.id">
                      <div class="type-selector">
                        <div 
                          class="type-input" 
                          @click="isEditTypeDropdownVisible = !isEditTypeDropdownVisible">
                          <span v-if="editForm[key]">{{ getTypeName(editForm[key]) }}</span>
                          <span v-else class="placeholder">请选择类型</span>
                          <span class="arrow">▼</span>
                        </div>

                        <div 
                          v-show="isEditTypeDropdownVisible" 
                          class="type-dropdown">
                          <div 
                            v-for="option in typeOptions" 
                            :key="option.value"
                            v-show="isVisible(option)"
                            class="type-option"
                            :class="{ 
                              'selected': editForm[key] === option.value,
                              [`level-${option.level}`]: true
                            }"
                            :style="{ paddingLeft: `${option.level * 20 + 10}px` }">
                            <!-- 展开/收起箭头 -->
                            <span 
                              v-if="hasChildren(option)"
                              class="expand-arrow"
                              @click.stop="toggleExpand(option.path)">
                              {{ expandedTypes.has(option.path) ? '▼' : '▶' }}
                            </span>
                            <span v-else class="expand-placeholder"></span>
                                        
                            <!-- 选项内容 -->
                            <div class="type-content" @click.stop="selectType(option.value, 'edit')">
                              <span>{{ option.label }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </template>

                    <template v-else-if="key === 'pic' && config.editable">
                      <div class="image-upload">
                        <!-- 显示当前图片 -->
                        <img 
                          v-if="editForm[key]" 
                          v-image="editForm[key]" 
                          class="preview-image"
                          @click="openImageViewer(editForm[key])">
                                    
                        <!-- 上传控件 -->
                        <div class="upload-controls">
                          <input
                            type="file"
                            accept="image/*"
                            ref="fileInput"
                            class="file-input"
                            @change="handleFileUpload"
                            style="display: none;">
                          <button 
                            class="upload-btn" 
                            @click="triggerFileInput(row.id)">
                            选择图片
                          </button>
                                      
                          <!-- 显示上传进度或错误 -->
                          <div v-if="uploadProgress" class="upload-progress">
                            上传中... {{ uploadProgress }}%
                          </div>
                          <div v-if="uploadError" class="upload-error">
                            {{ uploadError }}
                          </div>
                        </div>
                      </div>
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
                        class="form-input">
                      <input
                        v-else
                        v-model="editForm[key]"
                        :type="config.type || 'text'"
                        class="form-input">
                    </template>
                    <template v-else>
                      {{ editForm[key] }}
                    </template>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>

          <!-- 添加显示更多按钮 -->
          <div v-if="hasMore" class="load-more">
            <button @click="loadMore" class="load-more-btn">
              显示更多
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 添加图片预览组件 -->
  <ImagePreview
    :visible="previewVisible"
    :image-url="previewImage"
    :title="previewTitle"
    @close="closePreview"/>
</template>

<style scoped>
/* 添加新样式 */
.load-more {
  text-align: center;
  margin: 20px 0;
  padding: 10px;
}

.load-more-btn {
  padding: 6px 10px;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.load-more-btn:hover {
  background-color: #3aa876;
}

.load-more-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* 确保表格底部有足够空间显示按钮 */
.table-wrapper {
  margin-bottom: 20px;
}

.table-wrapper a {
  cursor: pointer;
}

.content-wrapper {
  margin: 20px auto 20px;
}

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

td {
  position: relative;
  max-width: 150px;  /* 调整单元格最大宽度 */
  white-space: nowrap;
  text-overflow: ellipsis;
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
  display: inline-block;
  margin-right: 10px;
  border-radius: 4px;
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

/* 确保下拉框在模态框内正确显示 */
.modal-content .type-selector {
  position: relative;
  width: 100%;
}

.modal-content .type-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000; /* 确保在模态框内位于最上层 */
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
  margin: 10px 0 30px;
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

.search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 1rem;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-item label {
  white-space: nowrap;
  font-size: 12px;
}

.search-item input {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  width: 120px;
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reset-btn {
  padding: 4px 12px;
  background-color: #909399;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.reset-btn:hover {
  background-color: #82848a;
}

.type-selector {
  position: relative;
  width: 200px;
}

td .type-selector {
  position: relative;
  width: 100%;
  min-width: 120px;  /* 设置最小宽度 */
}

td .type-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;  /* 下拉框最小宽度 */
  max-width: 300px;  /* 下拉框最大宽度 */
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  z-index: 1000;
}

.type-input {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

td .type-input {
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.placeholder {
  color: #999;
}

.arrow {
  font-size: 10px;
  color: #666;
}

.type-dropdown {
  font-size: 12px;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  margin-top: 4px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
  z-index: 1000;
}

.type-option {
  padding: 8px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.expand-arrow {
  width: 20px;
  cursor: pointer;
  user-select: none;
  font-size: 10px;
  color: #666;
  transition: transform 0.2s ease;
}

.selected .expand-arrow {
  color: #409EFF;
}

.expand-placeholder {
  width: 20px;
}

.type-content {
  display: flex;
  align-items: center;
  flex: 1;
}

/* 不同层级的样式 */
.type-option.level-0 {
  font-weight: bold;
}

.type-option.level-1 {
  background-color: #fafafa;
}

/* 确保子项在展开时有过渡效果 */
.type-dropdown {
  transition: max-height 0.3s ease-in-out;
}

.type-option:hover {
  background-color: #f5f7fa;
}

.type-option.selected {
  background-color: #ecf5ff;
  color: #409EFF;
  font-weight: 500;
  border-left-color: #409EFF;
}

/* 不同层级的缩进和样式 */
.type-option.level-0 {
  font-weight: bold;
}

.type-option.level-1 {
  background-color: #fafafa;
}

/* 美化滚动条 */
.type-dropdown::-webkit-scrollbar {
  width: 6px;
}

.type-dropdown::-webkit-scrollbar-thumb {
  background-color: #ddd;
  border-radius: 3px;
}

.type-dropdown::-webkit-scrollbar-track {
  background-color: #f5f5f5;
}

.required {
  color: red;
  margin-left: 4px;
}

.form-input.error {
  border-color: red;
}

.error-text {
  color: red;
  font-size: 12px;
  margin-top: 4px;
}

.image-upload {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.preview-image {
  max-width: 100px;
  max-height: 100px;
  object-fit: contain;
  cursor: pointer;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 2px;
}

.preview-image:hover {
  border-color: #42b883;
}

.upload-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.file-input {
  display: none;
}

.upload-btn {
  padding: 5px 10px;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.upload-btn:hover {
  background-color: #3aa876;
}

.upload-progress {
  font-size: 12px;
  color: #666;
}

.upload-error {
  font-size: 12px;
  color: #dc3545;
}

.stock-toggle {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #666;
  cursor: pointer;
}

.stock-toggle input {
  margin-right: 4px;
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