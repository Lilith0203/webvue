<script setup>
import axios from '../api'
import ImagePreview from '../components/ImagePreview.vue'
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { confirm } from '../utils/confirm'
import { useRoute } from 'vue-router'

const authStore = useAuthStore()
const route = useRoute()

const materialData = ref(null)
const loading = ref(false)
const error = ref(null)
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

    if (rowId === 'new') {
      newMaterialForm.value.pic = response.data.url
    } else if (
      isMaterialModalOpen.value &&
      materialModalMode.value === 'edit' &&
      editingMaterialId.value === rowId
    ) {
      newMaterialForm.value.pic = response.data.url
    } else if (batchEditDrafts.value[rowId]) {
      batchEditDrafts.value[rowId].pic = response.data.url
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

// 列表排序：尺寸为前端排序；添加/更新时间为后端排序
const sortBy = ref(null)
const sortDirection = ref('asc')
const isTimeSort = (field) => field === 'createdAt' || field === 'updatedAt'

const setListSort = async (field) => {
  const initialDir = field === 'size' ? 'asc' : 'desc'
  let needRefetch = false

  if (sortBy.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    if (sortDirection.value === initialDir) {
      sortBy.value = null
      needRefetch = isTimeSort(field)
    } else if (isTimeSort(field)) {
      needRefetch = true
    }
  } else {
    sortBy.value = field
    sortDirection.value = initialDir
    needRefetch = isTimeSort(field)
  }

  if (needRefetch) {
    await fetchMaterialData()
  }
}

const matchesSearchFilter = (item) => {
  if (!item) return false
  return (
    (!searchForm.value.id || item.id.toString() === searchForm.value.id) &&
    (!searchForm.value.name || item.name.toLowerCase().includes(searchForm.value.name.toLowerCase())) &&
    (!searchForm.value.type.length || searchForm.value.type.includes(item.type)) &&
    (!searchForm.value.substance || item.substance.toLowerCase().includes(searchForm.value.substance.toLowerCase())) &&
    (!searchForm.value.shape || item.shape.toLowerCase().includes(searchForm.value.shape.toLowerCase())) &&
    (!searchForm.value.color || item.color.toLowerCase().includes(searchForm.value.color.toLowerCase())) &&
    (!searchForm.value.shop || item.shop.toLowerCase().includes(searchForm.value.shop.toLowerCase())) &&
    (!searchForm.value.size || (item.size || '').toLowerCase().includes(searchForm.value.size.toLowerCase()))
  )
}

const parseSizeForSort = (str) => {
  if (!str) return [Infinity, Infinity]
  const match = str.match(/^\s*(\d+(?:\.\d+)?)\s*[\*×]\s*(\d+(?:\.\d+)?)(?:\s*mm)?/i)
  if (match) {
    return [parseFloat(match[1]), parseFloat(match[2])]
  }
  const num = str.match(/\d+(?:\.\d+)?/)
  return num ? [parseFloat(num[0]), -1] : [Infinity, Infinity]
}

const applySizeSort = (list) => {
  const sorted = [...list]
  sorted.sort((a, b) => {
    const [a1, a2] = parseSizeForSort(a.size || '')
    const [b1, b2] = parseSizeForSort(b.size || '')
    if (a1 !== b1) return sortDirection.value === 'asc' ? a1 - b1 : b1 - a1
    if (a2 !== b2) return sortDirection.value === 'asc' ? a2 - b2 : b2 - a2
    const sa = (a.size || '').replace(/\s/g, '').toLowerCase()
    const sb = (b.size || '').replace(/\s/g, '').toLowerCase()
    return sa.localeCompare(sb)
  })
  return sorted
}

const formatExportDateTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('zh-CN')
}

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const materialToExcelRow = (row) => [
  row.id,
  row.name,
  typeMap.value.get(row.type) || row.type,
  row.substance ?? '',
  row.size ?? '',
  row.shape ?? '',
  row.color ?? '',
  row.price ?? '',
  row.stock ?? '',
  row.shop ?? '',
  row.note ?? '',
  row.link ?? '',
  row.pic ?? '',
  formatExportDateTime(row.createdAt),
  formatExportDateTime(row.updatedAt)
]

const exportMaterialsExcel = () => {
  if (!authStore.isAuthenticated) {
    error.value = '请先登录后再导出'
    return
  }
  const list = filteredMaterials.value
  if (!list.length) {
    error.value = '当前筛选结果为空，无可导出数据'
    return
  }

  const headers = [
    'ID', '名称', '类型', '材质', '尺寸', '形状', '颜色',
    '价格', '库存', '商店', '备注', '链接', '图片', '添加时间', '更新时间'
  ]
  const headerRow = headers
    .map((h) => `<Cell><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join('')
  const dataRows = list
    .map((row) => {
      const cells = materialToExcelRow(row)
        .map((v) => `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`)
        .join('')
      return `<Row>${cells}</Row>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="材料">
  <Table>
   <Row>${headerRow}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`

  const blob = new Blob(['\ufeff' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_')
  const a = document.createElement('a')
  a.href = url
  a.download = `materials_${stamp}.xls`
  a.click()
  URL.revokeObjectURL(url)
  error.value = null
}

// 修改重置搜索方法，也重置排序并重新拉取列表
const resetSearch = async () => {
  searchForm.value = {
    id: '',
    name: '',
    type: [],
    substance: '',
    shape: '',
    color: '',
    shop: '',
    size: ''
  }
  displayLimit.value = 50  // 重置显示数量
  sortBy.value = null      // 重置排序方式
  sortDirection.value = 'asc' // 重置排序方向
  await fetchMaterialData()
}

// 筛选后的全部材料（导出用，不限条数）
const filteredMaterials = computed(() => {
  if (!materialData.value) return []
  return materialData.value.filter(matchesSearchFilter)
})

// 计算当前显示的材料
const displayedMaterials = computed(() => {
  let result = filteredMaterials.value
  if (sortBy.value === 'size') {
    result = applySizeSort(result)
  }
  return result.slice(0, displayLimit.value)
})

// 是否还有更多材料可以显示
const hasMore = computed(() => filteredMaterials.value.length > displayLimit.value)

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
    // 未登录（401）或无权限时：按“空类型树”处理，不显示报错
    if (err?.response?.status === 401) {
      typeTree.value = []
      typeMap.value = new Map()
      error.value = null
    } else {
      error.value = "获取类型数据失败：" + err.message
    }
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

const batchEditMode = ref(false)
const selectedMaterialIds = ref(new Set())
const batchEditDrafts = ref({})
const activeTypeDropdownRowId = ref(null)
const isMaterialModalOpen = ref(false)
const materialModalMode = ref('add')
const editingMaterialId = ref(null)
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
  pic: '',
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
    link: '',
    pic: ''
  }
  uploadError.value = null
  uploadProgress.value = 0
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
      visibleColumns.value.includes(key) &&
      !(batchEditMode.value && key === 'actions')
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
      'price',
      'stock',
      'shop',
      'note',
      'actions'
    ]
  }
}

//搜索条件
const searchForm = ref({
  id: '', // 添加ID搜索
  name: '',
  type: [], // 类型多选
  substance: '',
  shape: '',
  color: '',
  shop: '',
  size: ''
})

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

// 选择类型（new / modal 使用弹窗表单，edit 使用行内编辑）
const selectType = (value, mode, rowId = null) => {
  if (mode === 'new' || mode === 'modal') {
    newMaterialForm.value.type = value
    isTypeDropdownVisible.value = false
  } else if (mode === 'edit' && rowId != null && batchEditDrafts.value[rowId]) {
    batchEditDrafts.value[rowId].type = value
    activeTypeDropdownRowId.value = null
  }
}

const toggleRowTypeDropdown = (rowId) => {
  activeTypeDropdownRowId.value =
    activeTypeDropdownRowId.value === rowId ? null : rowId
}

const isRowEditing = (row) =>
  batchEditMode.value &&
  Object.prototype.hasOwnProperty.call(batchEditDrafts.value, row.id)

//判断是否有编辑权限
const canEdit = computed(() => {
  return authStore.isAuthenticated
})

const clearBatchEditDrafts = () => {
  batchEditDrafts.value = {}
  activeTypeDropdownRowId.value = null
}

const materialModalTitle = computed(() =>
  materialModalMode.value === 'add' ? '新增材料' : '编辑材料'
)

const modalPicUploadId = computed(() =>
  materialModalMode.value === 'edit' && editingMaterialId.value != null
    ? editingMaterialId.value
    : 'new'
)

const closeMaterialModal = () => {
  isMaterialModalOpen.value = false
  materialModalMode.value = 'add'
  editingMaterialId.value = null
  resetForm()
}

const openAddModal = () => {
  materialModalMode.value = 'add'
  editingMaterialId.value = null
  resetForm()
  isMaterialModalOpen.value = true
}

const openEditModal = (row) => {
  if (!row) return
  materialModalMode.value = 'edit'
  editingMaterialId.value = row.id
  newMaterialForm.value = {
    name: row.name || '',
    type: row.type || '',
    substance: row.substance || '',
    size: row.size || '',
    shape: row.shape || '',
    color: row.color || '',
    price: row.price || '',
    stock: row.stock || '',
    shop: row.shop || '',
    note: row.note || '',
    link: row.link || '',
    pic: row.pic || ''
  }
  formErrors.value = {}
  uploadError.value = null
  uploadProgress.value = 0
  isTypeDropdownVisible.value = false
  isMaterialModalOpen.value = true
}

const selectedCount = computed(() => selectedMaterialIds.value.size)

const selectedMaterialRows = computed(() =>
  displayedMaterials.value.filter((m) => selectedMaterialIds.value.has(m.id))
)

const batchEditingCount = computed(() => Object.keys(batchEditDrafts.value).length)

const startEdit = (row) => {
  if (!canEdit.value || !row) return
  if (batchEditMode.value) {
    if (!batchEditDrafts.value[row.id]) {
      batchEditDrafts.value = { ...batchEditDrafts.value, [row.id]: { ...row } }
    }
    return
  }
  openEditModal(row)
}

const cancelBatchEdits = () => {
  clearBatchEditDrafts()
}

const toggleBatchEditMode = () => {
  batchEditMode.value = !batchEditMode.value
  if (batchEditMode.value) {
    closeMaterialModal()
  } else {
    selectedMaterialIds.value = new Set()
    clearBatchEditDrafts()
  }
}

const startBatchEditSelected = () => {
  const rows = selectedMaterialRows.value
  if (!rows.length) {
    error.value = '请先勾选要编辑的材料'
    return
  }
  const drafts = {}
  rows.forEach((row) => {
    drafts[row.id] = { ...row }
  })
  batchEditDrafts.value = drafts
  error.value = null
}

const saveBatchEdits = async () => {
  if (!canEdit.value) return
  const materials = Object.values(batchEditDrafts.value)
  if (!materials.length) {
    error.value = '没有正在编辑的材料'
    return
  }

  try {
    loading.value = true
    error.value = null
    const response = await axios.post('/batchUpdateMaterial', { materials })
    const { updated = 0, failed = [] } = response.data || {}
    await fetchMaterialData({ silent: true })
    clearBatchEditDrafts()

    if (failed.length) {
      error.value = response.data?.message || `已更新 ${updated} 条，${failed.length} 条失败`
      console.warn('批量更新失败明细：', failed)
    }
  } catch (err) {
    error.value = '批量保存失败：' + (err.response?.data?.message || err.message)
  } finally {
    loading.value = false
  }
}

const toggleSelectMaterial = (id) => {
  const next = new Set(selectedMaterialIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedMaterialIds.value = next
}

const allDisplayedSelected = computed(() => {
  const list = displayedMaterials.value
  return list.length > 0 && list.every((r) => selectedMaterialIds.value.has(r.id))
})

const toggleSelectAllDisplayed = () => {
  if (allDisplayedSelected.value) {
    selectedMaterialIds.value = new Set()
  } else {
    selectedMaterialIds.value = new Set(displayedMaterials.value.map((r) => r.id))
  }
}

// 获取材料列表（silent：后台刷新，不挡表格）
const fetchMaterialData = async ({ silent = false } = {}) => {
  if (!authStore.isAuthenticated) {
    materialData.value = []
    return
  }

  if (!silent) {
    loading.value = true
    error.value = null
  }

  try {
    const body = {
      showAll: showOutOfStock.value
    }
    if (isTimeSort(sortBy.value)) {
      body.sortBy = sortBy.value
      body.sortOrder = sortDirection.value.toUpperCase()
    }
    const response = await axios.post(`/material`, body)
    materialData.value = response.data.materials
  } catch (err) {
    if (err?.response?.status === 401) {
      materialData.value = []
      if (!silent) error.value = null
    } else if (!silent) {
      error.value = '获取数据失败：' + err.message
    }
  } finally {
    if (!silent) loading.value = false
  }
}

// 类型树 + 材料列表并行加载
const loadMaterialPageData = async () => {
  if (!authStore.isAuthenticated) {
    materialData.value = []
    typeTree.value = []
    typeMap.value = new Map()
    error.value = null
    return
  }

  loading.value = true
  error.value = null
  try {
    await Promise.all([
      fetchTypeTree(),
      fetchMaterialData({ silent: true })
    ])
  } catch (err) {
    error.value = '加载失败：' + (err?.response?.data?.message || err.message)
  } finally {
    loading.value = false
  }
}

const upsertMaterialRow = (row) => {
  if (!row?.id) return
  const list = materialData.value ? [...materialData.value] : []
  const index = list.findIndex((item) => item.id === row.id)
  if (index >= 0) {
    list[index] = { ...list[index], ...row }
  } else {
    list.push(row)
  }
  materialData.value = list
}

const removeMaterialRow = (id) => {
  if (!materialData.value) return
  materialData.value = materialData.value.filter((item) => item.id !== id)
}

// 监听 showOutOfStock 变化，重新获取材料
watch(showOutOfStock, () => {
  fetchMaterialData()
})

// 登录状态变化时自动刷新数据
watch(
  () => authStore.isAuthenticated,
  (loggedIn) => {
    if (loggedIn) {
      loadMaterialPageData()
    } else {
      materialData.value = []
      typeTree.value = []
      typeMap.value = new Map()
      error.value = null
      loading.value = false
    }
  },
  { immediate: true }
)

// 弹窗保存（新增 / 单条编辑）
const saveMaterialFromModal = async () => {
  if (!canEdit.value) return

  formErrors.value = {}
  if (!newMaterialForm.value.color) {
    formErrors.value.color = '请输入颜色'
    return
  }

  try {
    loading.value = true
    let response
    if (materialModalMode.value === 'add') {
      response = await axios.post('/addMaterial', newMaterialForm.value)
    } else {
      response = await axios.post('/updateMaterial', {
        id: editingMaterialId.value,
        ...newMaterialForm.value
      })
    }
    if (materialModalMode.value === 'add') {
      const created = response?.data?.data
      const hiddenByStock =
        !showOutOfStock.value &&
        (created?.stock === '0' || created?.stock === '无')
      if (created?.id && !hiddenByStock) {
        upsertMaterialRow(created)
      } else {
        await fetchMaterialData({ silent: true })
      }
    } else {
      upsertMaterialRow({
        id: editingMaterialId.value,
        ...newMaterialForm.value
      })
    }
    closeMaterialModal()
  } catch (err) {
    error.value =
      (materialModalMode.value === 'add' ? '添加失败：' : '更新失败：') + err.message
  } finally {
    loading.value = false
  }
}

// 打开复制材料模态框
const openCopyMaterialModal = async (row) => {
  if (!row) return;
  
  try {
    materialModalMode.value = 'add'
    editingMaterialId.value = null
    isMaterialModalOpen.value = true

    newMaterialForm.value = {
      name: row.name,
      type: row.type || '',
      substance: row.substance || '',
      size: row.size || '',
      shape: row.shape || '',
      color: row.color || '',
      price: row.price || '',
      stock: row.stock || '',
      shop: row.shop || '',
      note: row.note || '',
      link: row.link || '',
      pic: row.pic || ''
    };
    
    // 重置错误状态
    formErrors.value = {};
  } catch (err) {
    error.value = '复制材料失败：' + err.message;
    console.error('复制材料错误:', err);
  }
}

// 添加删除方法
const deleteMaterial = async (row) => {
  if (!canEdit.value) return
  
  // 添加确认提示
  if (!await confirm('确定要删除这条记录吗？')) {
    return
  }

  try {
    loading.value = true
    await axios.post('/deleteMaterial', { id: row.id })
    removeMaterialRow(row.id)
  } catch (err) {
    error.value = '删除失败：' + err.message
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
      activeTypeDropdownRowId.value = null
    }
  })
  loadColumnSettings()

  // 检查URL查询参数中的ID
  if (route.query.id) {
    searchForm.value.id = route.query.id.toString()
  }
})

// 修改表格显示逻辑，显示类型名称而不是ID
const getTypeName = (typeId) => {
  return typeMap.value.get(typeId) || typeId
}

// 删除图片
const removeImage = (rowId) => {
  if (
    rowId === 'new' ||
    (materialModalMode.value === 'edit' && editingMaterialId.value === rowId)
  ) {
    newMaterialForm.value.pic = ''
    return
  }
  if (batchEditDrafts.value[rowId]) {
    batchEditDrafts.value[rowId].pic = ''
  }
}

// 跳转到材料详情页（通过ID搜索）
const goToMaterialById = (materialId) => {
  // 设置ID搜索条件
  searchForm.value.id = materialId.toString()
  searchForm.value.name = ''
  searchForm.value.type = []
  searchForm.value.substance = ''
  searchForm.value.shape = ''
  searchForm.value.color = ''
  searchForm.value.shop = ''
  searchForm.value.size = ''
  
  // 重置显示限制
  displayLimit.value = 50
}

</script>

<template>
  <div class="content-wrapper">
    <!-- 列设置按钮和下拉菜单 -->
    <div class="table-controls">
      <div class="column-settings">
        <button 
          class="settings-btn"
            @click="saveColumnSettings(); isColumnSettingsVisible = !isColumnSettingsVisible">
          列设置
        </button>
        <RouterLink 
          v-if="canEdit"
          to="/material/type"
          class="category-link"><button class="category-link-btn">分类管理</button>
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
            <i class="iconfont icon-zhankai"></i>
          </button>
        </div>
      </div>

      <!-- 添加新材料按钮 -->
      <div v-if="canEdit" class="add-material">
        <button
          v-if="!batchEditMode"
          class="batch-edit-btn"
          @click="toggleBatchEditMode">
          批量编辑
        </button>
        <button v-if="!batchEditMode" class="add-btn" @click="openAddModal">
          新增
        </button>
        <button
          v-if="!batchEditMode"
          type="button"
          class="export-btn"
          :disabled="!authStore.isAuthenticated"
          @click="exportMaterialsExcel">
          导出
        </button>
      </div>
    </div>

    <!-- 新增 / 编辑材料弹窗 -->
    <div v-if="isMaterialModalOpen" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ materialModalTitle }}</h3>
          <button class="close-btn" @click="closeMaterialModal">
            ×
          </button>
        </div>
        
        <div class="form-grid">
          <div v-for="(config, key) in columns" :key="key" class="form-item"
            :style="{ display: (key !== 'id' && key !== 'actions') ? 'block' : 'none' }">
            <template v-if="key !== 'id' && key !== 'actions'">
              <label>{{ config.label }}</label>
              <template v-if="key === 'pic'">
                <div class="image-upload">
                  <div v-if="newMaterialForm.pic" class="image-preview-container">
                    <img
                      v-image="newMaterialForm.pic"
                      class="preview-image"
                      @click="openImageViewer(newMaterialForm.pic)">
                    <button
                      type="button"
                      class="delete-image-btn"
                      @click="removeImage(modalPicUploadId)">
                      x
                    </button>
                  </div>
                  <div class="upload-controls">
                    <button
                      type="button"
                      class="upload-btn"
                      @click="triggerFileInput(modalPicUploadId)">
                      {{ newMaterialForm.pic ? '更换图片' : '选择图片' }}
                    </button>
                    <div v-if="uploadProgress" class="upload-progress">
                      上传中... {{ uploadProgress }}%
                    </div>
                    <div v-if="uploadError" class="upload-error">
                      {{ uploadError }}
                    </div>
                  </div>
                </div>
              </template>
              <template v-else-if="key === 'type'">
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
                  type="text"
                  class="form-input"
                  required 
                  :class="{ 'error': formErrors.color }"  
                  placeholder="请输入颜色">
                <!-- 显示错误信息 -->
                <span v-if="formErrors.color" class="error-text">{{ formErrors.color }}</span>
              </template>
              <template v-else>
                <input
                  v-model="newMaterialForm[key]"
                  :type="config.type || 'text'"
                  class="form-input">
              </template>
            </template>
          </div>
        </div>
        
        <div class="form-actions">
          <button class="save-btn" @click="saveMaterialFromModal">保存</button>
          <button class="cancel-btn" @click="closeMaterialModal">取消</button>
        </div>
      </div>
    </div>

    <!-- 搜索表单 -->
    <div class="search-form">
      <div class="search-item">
        <label>ID：</label>
        <input 
          v-model="searchForm.id"
          type="text"
          class="id-search"
          placeholder="编号">
      </div>
      
      <div class="search-item">
        <label>名称：</label>
        <input 
          v-model="searchForm.name"
          type="text"
          placeholder="">
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
          placeholder="">
      </div>
      
      <div class="search-item">
        <label>形状：</label>
        <input 
          v-model="searchForm.shape"
          type="text"
          placeholder="">
      </div>
      
      <div class="search-item">
        <label>颜色：</label>
        <input 
          v-model="searchForm.color"
          type="text"
          placeholder="">
      </div>
      <div class="search-item">
        <label>店铺：</label>
        <input 
          v-model="searchForm.shop"
          type="text"
          placeholder="">
      </div>
      <div class="search-item">
        <label>尺寸：</label>
        <input 
          v-model="searchForm.size"
          type="text"
          placeholder="">
      </div>
      
      <div class="search-actions">
        <label class="stock-toggle">
          <input type="checkbox" v-model="showOutOfStock">
          <span>显示无库存</span>
        </label>
        
        <button class="reset-btn" @click="resetSearch"><i class="iconfont icon-shuaxin"></i></button>
      </div>
    </div>

    <div class="material-list-toolbar">
      <div class="sort-row">
        <span class="toolbar-label">排序：</span>
        <div class="sort-options">
          <button
            class="sort-btn"
            :class="{ active: sortBy === 'size' }"
            @click="setListSort('size')">
            按尺寸
            <span v-if="sortBy === 'size'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
          </button>
          <button
            class="sort-btn"
            :class="{ active: sortBy === 'createdAt' }"
            @click="setListSort('createdAt')">
            添加时间
            <span v-if="sortBy === 'createdAt'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
          </button>
          <button
            class="sort-btn"
            :class="{ active: sortBy === 'updatedAt' }"
            @click="setListSort('updatedAt')">
            更新时间
            <span v-if="sortBy === 'updatedAt'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="batchEditMode" class="batch-actions-bar">
      <span class="batch-selected-count">已选 <strong>{{ selectedCount }}</strong> 条</span>
      <button
        type="button"
        class="batch-action-btn"
        :disabled="selectedCount === 0"
        @click="startBatchEditSelected">
        编辑选中
      </button>
      <span v-if="batchEditingCount" class="batch-progress">正在编辑 {{ batchEditingCount }} 条</span>
      <button
        type="button"
        class="batch-action-btn primary"
        :disabled="batchEditingCount === 0 || loading"
        @click="saveBatchEdits">
        保存
      </button>
      <button
        type="button"
        class="batch-action-btn"
        :disabled="batchEditingCount === 0"
        @click="cancelBatchEdits">
        取消编辑
      </button>
      <button type="button" class="batch-action-btn exit" @click="toggleBatchEditMode">
        退出
      </button>
    </div>

    <div class="material-table">

      <div class="material-table-header">
        <div v-if="loading">加载中...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else class="table-wrapper">
          <table v-if="displayedMaterials.length">
            <thead>
              <tr>
                <th v-if="batchEditMode" class="batch-check-col">
                  <input
                    type="checkbox"
                    :checked="allDisplayedSelected"
                    @change="toggleSelectAllDisplayed">
                </th>
                <th v-for="(config, key) in visibleColumnsConfig" :key="key">
                  {{ config.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in displayedMaterials"
                :key="row.id"
                :class="{ 'batch-selected': batchEditMode && selectedMaterialIds.has(row.id) }"
                @dblclick="batchEditMode && startEdit(row)">
                <!-- 显示模式 -->
                <template v-if="!isRowEditing(row)">
                  <td v-if="batchEditMode" class="batch-check-col">
                    <input
                      type="checkbox"
                      :checked="selectedMaterialIds.has(row.id)"
                      @change="toggleSelectMaterial(row.id)">
                  </td>
                  <td v-for="(config, key) in visibleColumnsConfig" :key="key">
                    <!-- 如果是操作列 -->
                    <template v-if="key === 'type'">
                      {{ getTypeName(row[key]) }}
                    </template>
                    <template v-else-if="key === 'actions' && canEdit">
                      <div class="action-buttons">
                        <button class="copy-btn" @click="openCopyMaterialModal(row)">
                          <i class="iconfont icon-fuzhi"></i>
                        </button>
                        <button class="edit-btn" @click="startEdit(row)"><i class="iconfont icon-edit"></i></button>
                        <button class="delete-btn" @click="deleteMaterial(row)"><i class="iconfont icon-ashbin"></i></button>
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

                <!-- 批量编辑：表格内联编辑 -->
                <template v-else>
                  <td class="batch-check-col">
                    <input
                      type="checkbox"
                      :checked="selectedMaterialIds.has(row.id)"
                      disabled>
                  </td>
                  <td v-for="(config, key) in visibleColumnsConfig" :key="key">
                    <template v-if="key === 'type'">
                      <div class="type-selector">
                        <div
                          class="type-input"
                          @click="toggleRowTypeDropdown(row.id)">
                          <span v-if="batchEditDrafts[row.id][key]">
                            {{ getTypeName(batchEditDrafts[row.id][key]) }}
                          </span>
                          <span v-else class="placeholder">请选择类型</span>
                          <span class="arrow">▼</span>
                        </div>

                        <div
                          v-show="activeTypeDropdownRowId === row.id"
                          class="type-dropdown">
                          <div
                            v-for="option in typeOptions"
                            :key="option.value"
                            v-show="isVisible(option)"
                            class="type-option"
                            :class="{
                              selected: batchEditDrafts[row.id][key] === option.value,
                              [`level-${option.level}`]: true
                            }"
                            :style="{ paddingLeft: `${option.level * 20 + 10}px` }">
                            <span
                              v-if="hasChildren(option)"
                              class="expand-arrow"
                              @click.stop="toggleExpand(option.path)">
                              {{ expandedTypes.has(option.path) ? '▼' : '▶' }}
                            </span>
                            <span v-else class="expand-placeholder"></span>
                            <div
                              class="type-content"
                              @click.stop="selectType(option.value, 'edit', row.id)">
                              <span>{{ option.label }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </template>

                    <template v-else-if="key === 'pic' && config.editable">
                      <div class="image-upload">
                        <div
                          v-if="batchEditDrafts[row.id][key]"
                          class="image-preview-container">
                          <img
                            v-image="batchEditDrafts[row.id][key]"
                            class="preview-image"
                            @click="openImageViewer(batchEditDrafts[row.id][key])">
                          <button
                            type="button"
                            class="delete-image-btn"
                            @click="removeImage(row.id)">
                            x
                          </button>
                        </div>
                        <div class="upload-controls">
                          <button
                            class="upload-btn"
                            @click="triggerFileInput(row.id)">
                            {{ batchEditDrafts[row.id][key] ? '更换图片' : '上传' }}
                          </button>
                          <div v-if="uploadProgress" class="upload-progress">
                            上传中... {{ uploadProgress }}%
                          </div>
                          <div v-if="uploadError" class="upload-error">
                            {{ uploadError }}
                          </div>
                        </div>
                      </div>
                    </template>

                    <template v-else-if="config.editable">
                      <input
                        v-if="config.type === 'number'"
                        v-model.number="batchEditDrafts[row.id][key]"
                        type="number"
                        class="form-input">
                      <input
                        v-else
                        v-model="batchEditDrafts[row.id][key]"
                        :type="config.type || 'text'"
                        class="form-input">
                    </template>
                    <template v-else>
                      {{ batchEditDrafts[row.id][key] }}
                    </template>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>

          <!-- 添加显示更多按钮 -->
          <div v-if="hasMore" class="load-more">
            <button @click="loadMore" class="load-more-btn">
              更多…
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

.category-link-btn {
  font-size: 0.8rem;
  background-color: var(--color-blue);
  color: #fff;
  padding: 3px 6px 4px;
  border-radius: 4px;
}

/* 添加新样式 */
.load-more {
  text-align: center;
  margin: 10px 0;
  padding: 10px;
}

.load-more-btn {
  padding: 3px 6px;
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.3s;
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
  font-size: 0.8rem;
  margin: 10px 0;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

th, td {
  border: 1px solid #ddd;
  padding: 4px 5px;
  text-align: left;
  max-width: 100px;
  white-space: normal; /* 允许文本换行 */
  word-wrap: break-word; /* 允许长单词断行 */
  word-break: break-all; /* 允许在任意字符间断行 */
}

td {
  position: relative;
  max-width: 150px;  /* 调整单元格最大宽度 */
  min-width: 50px;
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

.copy-btn, .edit-btn, .delete-btn {
  background-color: transparent;
  padding: 2px 0px;
  border: none;
  cursor: pointer;
}

.edit-btn:hover,
.delete-btn:hover {
  opacity: 0.8;
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
  padding: 3px 6px 4px;
  font-size: 0.8rem;
  background-color: #666;
  color: white;
  display: inline-block;
  margin-right: 0;
  border-radius: 4px;
  border: none;
}

.column-dropdown {
  position: absolute;
  left: 0;
  top: 100%;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px 0px 5px 15px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  z-index: 1000;
  min-width: 110px;
}

.column-options {
  max-height: 300px;
  overflow-y: auto;
}

.column-option {
  font-size: 0.8rem;
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
  padding: 10px 20px 0 20px;
  background-color: transparent;
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
}

.modal-header h3 {
  margin: 0;
  font-size: 0.9rem;
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
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
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
  justify-content: center;
  gap: 6px;
  margin: 15px 0 0px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.8rem;
}

.form-textarea {
  min-height: 60px;
  resize: vertical;
}

/* 按钮样式 */
.add-material {
  display: flex;
  align-items: center;
  gap: 0px;
}

.batch-edit-btn {
  font-size: 0.8rem;
  background-color: #f0f0f0;
  color: #333;
  padding: 3px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.batch-edit-btn.active {
  background-color: var(--color-red);
  color: white;
  border: none;
}

.add-btn {
  font-size: 0.8rem;
  background-color: var(--color-green);
  color: white;
  padding: 3px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.export-btn {
  font-size: 0.8rem;
  background-color: var(--color-blue);
  color: white;
  padding: 3px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.export-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.export-btn:disabled {
  background-color: #c0c4cc;
  cursor: not-allowed;
}

.batch-check-col {
  width: 36px;
  text-align: center;
}

.batch-check-col input[type='checkbox'] {
  cursor: pointer;
}

tr.batch-selected {
  background-color: #ecf5ff;
}

.batch-actions-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 0.75rem;
  padding: 0.6rem 1rem;
  background: #e8f4ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  font-size: 12px;
}

.batch-selected-count {
  color: #303133;
}

.batch-selected-count strong {
  color: var(--color-blue);
}

.batch-action-btn {
  padding: 2px 10px 3px;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}

.batch-action-btn.primary {
  background: var(--color-blue);
  color: #fff;
  border-color: var(--color-blue);
}

.batch-action-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
}

.batch-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch-action-btn.exit {
  background: var(--color-red);
  color: #fff;
  border: none;
}

.batch-progress {
  color: var(--color-blue);
  font-weight: 500;
}

.save-btn {
  font-size: 0.8rem;
  background-color: var(--color-green);
  color: white;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
}

.cancel-btn {
  font-size: 0.8rem;
  background-color: var(--color-red);
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
  padding: 1rem;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 0px;
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
  width: 80px;
}

.search-item input.id-search {
  width: 60px;
}

.search-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.reset-btn {
  padding: 0;
  background-color: transparent;
  border: none;
  cursor: pointer;
  margin-left: 10px;
}

.type-selector {
  position: relative;
  width: 140px;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  line-height: normal;
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
  font-size: 9px;
  color: #666;
}

.type-dropdown {
  font-size: 12px;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 400px;
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
  align-items: center;
}

.image-preview-container {
  position: relative;
  display: inline-block;
  margin-top: 5px;
}

.delete-image-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--color-red);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.delete-image-btn:hover {
  opacity: 1;
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
  padding: 2px 5px 3px;
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
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

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 800px;
  }
}

/* 排序按钮样式 */
.sort-options {
  display: flex;
}

.sort-btn {
  padding: 2px 8px 3px;
  background-color: #f4f4f4;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  color: #333;
  transition: all 0.3s;
}

.sort-btn:hover {
  background-color: #e0e0e0;
}

.sort-btn.active {
  background-color: var(--color-green);
  color: white;
  border: none;
}

/* 调整搜索操作区域的布局 */
.search-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.material-list-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  padding: 0 1rem 0.75rem;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.sort-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-label {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
}

.toolbar-btn {
  padding: 3px 12px 4px;
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.toolbar-btn:hover:not(:disabled) {
  background-color: #66b1ff;
}

.toolbar-btn:disabled {
  background-color: #c0c4cc;
  cursor: not-allowed;
}
</style>