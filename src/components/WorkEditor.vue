<!-- components/WorkEditor.vue -->
<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from '../api'
import { message } from '../utils/message'
import { marked } from 'marked'

const dragIndex = ref(null)
const dragTarget = ref(null)
const touchStartY = ref(0)
const touchStartIndex = ref(null)
const touchElement = ref(null)
const initialY = ref(0)
// 状态
const submitting = ref(false)
const newTag = ref('')
const contentEditor = ref(null)

const props = defineProps({
  visible: Boolean,
  work: {
    type: Object,
    default: () => ({
      id: null,
      name: '',
      description: '',
      pictures: [],
      tags: [],
      materials: [],
      price: ''
    })
  },
  mode: {
    type: String,
    default: 'create' // 'create' 或 'edit'
  }
})

const emit = defineEmits(['cancel', 'success'])

const form = ref({
  name: '',
  description: '',
  tags: [],
  pictures: [],
  materials: [],
  price: ''
})

// 材料列表
const materials = ref([])
// 选中的材料（包含数量信息）
const selectedMaterials = ref([])
// 材料搜索关键词
const materialSearchQuery = ref({
  name: '',
  type: [], // 类型多选
  substance: '',
  color: '',
  shape: '',
  size: ''
})
// 是否显示材料选择器
const showMaterialSelector = ref(false)
// 是否已加载材料数据
const materialsLoaded = ref(false)
// 搜索结果数量限制
const maxSearchResults = 100
// 当前编辑的材料
const editingMaterial = ref(null)
// 材料数量输入
const materialQuantity = ref(1)
// 是否正在编辑已添加的材料
const isEditingExisting = ref(false)
// 是否显示Markdown预览
const showPreview = ref(false)

// 类型树数据
const typeTree = ref([])
const typeMap = ref(new Map()) // 存储id和typeName的映射

const initFormData = () => {
  return {
    id: props.work?.id || null,
    name: props.work?.name || '',
    description: props.work?.description || '',
    pictures: [...(props.work?.pictures || [])],
    tags: [...(props.work?.tags || [])],
    materials: [...(props.work?.materials || [])],
    video: props.work?.video || '',
    link: props.work?.link || '',
    price: props.work?.price || '',
    status: props.work?.status !== undefined ? props.work.status : 0 // 0: 未完成, 1: 已完成
  }
}

// 表单数据
const formData = reactive(initFormData())

// 图片上传相关操作
const handleImageUpload = async (event) => {
  const files = event.target.files
  if (!files.length) return

  await uploadFiles(files)
}

// 视频上传相关操作
const handleVideoUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // 检查文件类型
  if (!file.type.startsWith('video/')) {
    message.alert('请选择视频文件')
    return
  }

  // 检查文件大小（限制200MB）
  if (file.size > 200 * 1024 * 1024) {
    message.alert('视频文件大小不能超过200MB')
    return
  }

  try {
    const upload = new FormData()
    upload.append('file', file)
    upload.append('folder', 'works')
    
    const response = await axios.post('/upload', upload, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 300000 // 5分钟超时
    })
    
    // 解析 URL
    const urlObj = new URL(response.data.url)
    // 移除签名相关参数
    const paramsToRemove = ['Expires', 'OSSAccessKeyId', 'Signature', 'security-token', 'x-oss-process']
    paramsToRemove.forEach(param => urlObj.searchParams.delete(param))
    
    formData.video = urlObj.toString()
  } catch (error) {
    console.error('上传视频失败:', error)
    if (error.code === 'ECONNABORTED') {
      message.alert('上传超时，请检查网络连接后重试')
    } else {
      message.alert('上传视频失败，请重试')
    }
  }
}

const handleDrop = async (event) => {
  const files = Array.from(event.dataTransfer.files)
    .filter(file => file.type.startsWith('image/'))
  await uploadFiles(files)
}

const uploadFiles = async (files) => {
  try {
    for (let file of files) {
      let upload = new FormData()
      upload.append('file', file)
      upload.append('folder', 'works');
      let response = await axios.post('/upload', upload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
      })
      // 解析 URL
      const urlObj = new URL(response.data.url);
      // 移除签名相关参数
      const paramsToRemove = ['Expires', 'OSSAccessKeyId', 'Signature', 'security-token','x-oss-process'];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      formData.pictures.push(urlObj.toString())
    }

  } catch (error) {
    console.error('上传图片失败:', error)
  }
}

const removePicture = (index) => {
  formData.pictures.splice(index, 1)
}

// 移除视频
const removeVideo = () => {
  formData.video = ''
}

// 触发视频文件选择
const triggerVideoUpload = () => {
  if (!formData.video) {
    document.querySelector('.video-file-input').click()
  }
}

// 处理标签
const addTag = () => {
  const tag = newTag.value.trim()
  if (tag && !formData.tags.includes(tag)) {
    formData.tags.push(tag)
  }
  newTag.value = ''
}

const removeTag = (tag) => {
  formData.tags = formData.tags.filter(t => t !== tag)
}

// 获取材料列表
const fetchMaterials = async () => {
  if (materialsLoaded.value) return
  
  try {
    const response = await axios.post('/material', {
      showAll: true // 添加参数控制是否显示所有材料
    })
    materials.value = response.data.materials
    materialsLoaded.value = true
  } catch (error) {
    console.error('获取材料失败:', error)
  }
}

// 获取类型树数据
const fetchTypeTree = async () => {
  try {
    const response = await axios.get('/getMaterialType')
    typeTree.value = response.data.typetree
    // 构建id和typeName的映射
    buildTypeMap(typeTree.value)
  } catch (err) {
    console.error('获取类型数据失败:', err)
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

// 获取类型名称
const getTypeName = (typeId) => {
  return typeMap.value.get(typeId) || typeId
}

// 类型选择相关状态
const showTypeDropdown = ref(false)
const selectedTypes = computed(() => {
  // 获取所有选中的类型
  const selectedIds = materialSearchQuery.value.type || []
  
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
  const currentTypes = materialSearchQuery.value.type || []
  const index = currentTypes.indexOf(typeId)
  
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
      currentTypes.includes(sibling.value) || sibling.value === typeId
    )
      
    if (allSiblingsSelected && parentId) {
      typesToAdd.push(parentId)
    }
  }
    
  materialSearchQuery.value.type = [...new Set([...currentTypes, ...typesToAdd])]
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
    
    materialSearchQuery.value.type = currentTypes.filter(id => !typesToRemove.includes(id))
  }
}

// 过滤材料
const filteredMaterials = computed(() => {
  // 检查是否有任何搜索条件
  const hasQuery = Object.values(materialSearchQuery.value).some(value => 
    Array.isArray(value) ? value.length > 0 : value.trim() !== ''
  )
  
  if (!hasQuery) {
    return []
  }
  
  return materials.value
    .filter(material => {
      // 检查每个搜索条件
      const nameMatch = !materialSearchQuery.value.name || 
        (material.name && material.name.toLowerCase().includes(materialSearchQuery.value.name.toLowerCase()))
      
      const typeMatch = !materialSearchQuery.value.type.length || 
        materialSearchQuery.value.type.includes(material.type)
      
      const substanceMatch = !materialSearchQuery.value.substance || 
        (material.substance && material.substance.toLowerCase().includes(materialSearchQuery.value.substance.toLowerCase()))
      
      const colorMatch = !materialSearchQuery.value.color || 
        (material.color && material.color.toLowerCase().includes(materialSearchQuery.value.color.toLowerCase()))
      
      const shapeMatch = !materialSearchQuery.value.shape || 
        (material.shape && material.shape.toLowerCase().includes(materialSearchQuery.value.shape.toLowerCase()))
      
      const sizeMatch = !materialSearchQuery.value.size || 
        (material.size && material.size.toLowerCase().includes(materialSearchQuery.value.size.toLowerCase()))
      
      // 所有条件都必须匹配（取交集）
      return nameMatch && typeMatch && substanceMatch && colorMatch && shapeMatch && sizeMatch
    })
    .slice(0, maxSearchResults)
})

// 搜索提示信息
const searchHint = computed(() => {  
  if (!materialSearchQuery.value.name && !materialSearchQuery.value.type.length && !materialSearchQuery.value.substance && !materialSearchQuery.value.color && !materialSearchQuery.value.shape && !materialSearchQuery.value.size) {
    return '请输入关键词搜索材料'
  }
  
  if (filteredMaterials.value.length === 0) {
    return '没有找到匹配的材料'
  }
  
  if (filteredMaterials.value.length === maxSearchResults) {
    return `显示前${maxSearchResults}个结果，请继续输入缩小范围`
  }
  
  return `找到${filteredMaterials.value.length}个结果`
})

// 选择材料
const selectMaterial = (material) => {
  if (!selectedMaterials.value.some(m => m.id === material.id)) {
    editingMaterial.value = material
    materialQuantity.value = 1
    isEditingExisting.value = false
  }
}

// 编辑已添加的材料
const editMaterialQuantity = (material) => {
  editingMaterial.value = material
  materialQuantity.value = material.quantity
  isEditingExisting.value = true
}

// 确认添加/编辑材料
const confirmAddMaterial = () => {
  if (editingMaterial.value && materialQuantity.value > 0) {
    if (isEditingExisting.value) {
      // 编辑已存在的材料
      const materialIndex = selectedMaterials.value.findIndex(m => m.id === editingMaterial.value.id)
      if (materialIndex >= 0) {
        selectedMaterials.value[materialIndex].quantity = parseInt(materialQuantity.value)
      }
      
      // 更新formData.materials
      const formDataIndex = formData.materials.findIndex(m => 
        typeof m === 'object' ? m.id === editingMaterial.value.id : m === editingMaterial.value.id
      )
      if (formDataIndex >= 0) {
        formData.materials[formDataIndex] = { 
          id: editingMaterial.value.id, 
          quantity: parseInt(materialQuantity.value) 
        }
      }
    } else {
      // 添加新材料
      const materialWithQuantity = {
        ...editingMaterial.value,
        quantity: parseInt(materialQuantity.value)
      }
      selectedMaterials.value.push(materialWithQuantity)
      
      // 更新formData.materials为新格式
      formData.materials.push({ 
        id: editingMaterial.value.id, 
        quantity: parseInt(materialQuantity.value) 
      })
    }
    
    // 重置状态
    editingMaterial.value = null
    materialQuantity.value = 1
    isEditingExisting.value = false
    
    // 恢复页面滚动
    document.body.style.overflow = ''
  }
}

// 取消添加/编辑材料
const cancelAddMaterial = () => {
  editingMaterial.value = null
  materialQuantity.value = 1
  isEditingExisting.value = false
  
  // 恢复页面滚动
  document.body.style.overflow = ''
}

// 移除材料
const removeMaterial = (material) => {
  selectedMaterials.value = selectedMaterials.value.filter(m => m.id !== material.id)
  formData.materials = formData.materials.filter(m => 
    typeof m === 'object' ? m.id !== material.id : m !== material.id
  )
}

// 切换材料选择器
const toggleMaterialSelector = () => {
  showMaterialSelector.value = !showMaterialSelector.value
  if (showMaterialSelector.value && !materialsLoaded.value) {
    fetchMaterials()
    fetchTypeTree()
  }
}

// 初始化表单
const initForm = async () => {
  if (props.work) {
    // 处理materials字段，兼容旧数据格式
    let materials = props.work.materials || []
    if (materials.length > 0 && typeof materials[0] === 'number') {
      // 旧格式：转换为新格式
      materials = materials.map(id => ({ id, quantity: 1 }))
    }
    
    // 直接更新formData，确保响应式更新
    formData.id = props.work.id || null
    formData.name = props.work.name || ''
    formData.description = props.work.description || ''
    formData.tags = [...(props.work.tags || [])]
    formData.pictures = [...(props.work.pictures || [])]
    formData.materials = [...materials]
    formData.video = props.work.video || ''
    formData.link = props.work.link || ''
    formData.price = props.work.price || ''
    formData.status = props.work.status !== undefined ? props.work.status : 0
    
    // 同时更新form.value以保持一致性
    form.value = {
      id: formData.id,
      name: formData.name,
      description: formData.description,
      tags: formData.tags,
      pictures: formData.pictures,
      materials: formData.materials,
      video: formData.video,
      link: formData.link,
      price: formData.price,
      status: formData.status
    }
    
    // 加载已选材料信息
    if (materials.length > 0) {
      await loadSelectedMaterials()
    }
  }
}

// 加载已选材料信息
const loadSelectedMaterials = async () => {
  try {
    // 提取材料ID列表
    const materialIds = formData.materials.map(m => 
      typeof m === 'object' ? m.id : m
    )
    
    const response = await axios.post('/material', {
      ids: materialIds
    })
    
    // 合并材料信息和数量
    selectedMaterials.value = response.data.materials.map(material => {
      const materialData = formData.materials.find(m => 
        (typeof m === 'object' ? m.id : m) === material.id
      )
      return {
        ...material,
        quantity: typeof materialData === 'object' ? materialData.quantity : 1
      }
    })
  } catch (error) {
    console.error('获取已选材料失败:', error)
  }
}

// 验证价格输入
const validatePrice = (value) => {
  // 允许为空
  if (!value) return true
  
  // 验证是否为有效数字
  const priceRegex = /^\d+(\.\d{1,2})?$/
  return priceRegex.test(value)
}

// 处理价格输入
const handlePriceInput = (event) => {
  const value = event.target.value
  
  // 只允许输入数字和小数点
  if (/^$|^\d+\.?\d{0,2}$/.test(value)) {
    formData.price = value
  } else {
    // 如果输入无效，恢复到上一个有效值
    event.target.value = formData.price
  }
}

// 格式化价格
const formatPrice = (price) => {
  return parseFloat(price).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

// 计算材料总成本
const calculateMaterialCost = computed(() => {
  if (!selectedMaterials.value || selectedMaterials.value.length === 0) {
    return 0
  }
  
  let totalCost = 0
  selectedMaterials.value.forEach(material => {
    const price = parseFloat(material.price) || 0
    const quantity = parseInt(material.quantity) || 1
    totalCost += price * quantity
  })
  
  return totalCost
})

// 渲染Markdown内容
const renderedDescription = computed(() => {
  if (!formData.description) return ''
  // 转义星号，防止被Markdown解析为斜体
  const escapedDescription = formData.description.replace(/\*/g, '\\*')
  return marked(escapedDescription)
})

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return
  
  submitting.value = true
  try {
    const url = props.mode === 'create' ? '/works/add' : `/works/edit`
    const method = 'post'

    // 验证价格
    if (formData.price && !validatePrice(formData.price)) {
      message.alert('请输入有效的价格，最多两位小数')
      return
    }
    
    // 确保发送的数据格式正确
    const submitData = {
      ...formData,
      id: props.mode === 'create' ? null : formData.id,
      pictures: formData.pictures || [],
      tags: formData.tags || [],
      materials: formData.materials || [],
      video: formData.video || '',
      link: formData.link || '',
      price: formData.price || 0,
      status: formData.status !== undefined ? parseInt(formData.status) : 0
    }
    
    const response = await axios[method](url, submitData)
    message.success(props.mode === 'create' ? '创建成功' : '更新成功')
    emit('success', response.data.work)
  } catch (error) {
    console.error('保存失败:', error)
    message.error(error.message)
  } finally {
    submitting.value = false
  }
}

// 处理触摸开始
const handleTouchStart = (e, index) => {
  touchStartIndex.value = index
  touchElement.value = e.target.closest('.preview-item')
  
  const touch = e.touches[0]
  touchStartY.value = touch.pageY
  initialY.value = touch.pageY
  
  // 添加拖动样式
  touchElement.value.classList.add('dragging')
  touchElement.value.style.position = 'relative'
  touchElement.value.style.zIndex = '1000'
}

// 处理触摸移动
const handleTouchMove = (e) => {
  if (!touchElement.value) return
  
  const touch = e.touches[0]
  const currentY = touch.pageY
  const deltaY = currentY - touchStartY.value
  
  // 移动元素
  touchElement.value.style.transform = `translateY(${deltaY}px)`
  
  // 检查是否需要交换位置
  const elements = document.querySelectorAll('.preview-item')
  const elementHeight = elements[0].offsetHeight
  const moveThreshold = elementHeight / 2
  
  elements.forEach((el, index) => {
    if (el === touchElement.value) return
    
    const rect = el.getBoundingClientRect()
    const centerY = rect.top + rect.height / 2
    
    if (Math.abs(touch.clientY - centerY) < moveThreshold) {
      // 交换位置
      if (index !== touchStartIndex.value) {
        const images = [...formData.pictures]
        const [removed] = images.splice(touchStartIndex.value, 1)
        images.splice(index, 0, removed)
        formData.pictures = images
        touchStartIndex.value = index
      }
    }
  })
}

// 处理触摸结束
const handleTouchEnd = () => {
  if (!touchElement.value) return
  
  // 移除拖动样式
  touchElement.value.classList.remove('dragging')
  touchElement.value.style.position = ''
  touchElement.value.style.zIndex = ''
  touchElement.value.style.transform = ''
  
  // 重置状态
  touchStartIndex.value = null
  touchElement.value = null
  touchStartY.value = 0
  initialY.value = 0
}

// 开始拖拽
const handleDragStart = (e, index) => {
  dragIndex.value = index
  e.target.classList.add('dragging')
}

// 拖拽进入新位置
const handleDragEnter = (e, index) => {
  if (dragIndex.value === null) return
  if (dragIndex.value === index) return
  
  dragTarget.value = index
  
  // 重新排序图片
  const pictures = [...formData.pictures]
  const [removed] = pictures.splice(dragIndex.value, 1)
  pictures.splice(index, 0, removed)
  formData.pictures = pictures
  dragIndex.value = index
}

// 拖拽结束
const handleDragEnd = (e) => {
  dragIndex.value = null
  dragTarget.value = null
  e.target.classList.remove('dragging')
}

// 取消
const cancel = () => {
  emit('cancel')
}

// 插入Markdown语法
const insertMarkdown = (prefix, suffix = '') => {
  const textarea = contentEditor.value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = formData.description
    
  const beforeText = text.substring(0, start)
  const selectedText = text.substring(start, end)
  const afterText = text.substring(end)
  
  formData.description = beforeText + prefix + selectedText + suffix + afterText
    
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(
      start + prefix.length,
      end + prefix.length
    )
  })
}

onMounted(async () => {
  await initForm()
  document.addEventListener('keydown', handleKeydown)
  
  // 点击外部关闭类型下拉框
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.type-selector')) {
      showTypeDropdown.value = false
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  // 确保组件销毁时恢复页面滚动
  document.body.style.overflow = ''
})

// 监听 work 变化
watch(() => props.work, async () => {
  await initForm()
}, { deep: true })

// 点击背景关闭模态框
const closeModalOnBackground = (event) => {
  if (event.target.classList.contains('quantity-input-modal')) {
    cancelAddMaterial()
  }
}

// 键盘事件处理
const handleKeydown = (event) => {
  if (event.key === 'Escape' && editingMaterial.value) {
    cancelAddMaterial()
  }
}
</script>

<template>
  <Transition name="fade">
    <div class="work-editor-overlay" v-if="visible">
      <div class="work-editor">
        <form @submit.prevent="handleSubmit">
          <div class="form-item">
            <label>名称</label>
            <input v-model="formData.name" required>
          </div>
  
          <div class="form-item">
            <label>描述</label>
            <div class="editor-toolbar">
              <button type="button" @click="insertMarkdown('**', '**')">粗体</button>
              <button type="button" @click="insertMarkdown('### ')">标题</button>
              <button type="button" @click="insertMarkdown('> ')">引用</button>
              <button type="button" @click="insertMarkdown('- ')">列表</button>
              <button type="button" @click="insertMarkdown('[]() ')">链接</button>
              <button type="button" @click="showPreview = !showPreview" class="preview-btn">
                {{ showPreview ? '编辑' : '预览' }}
              </button>
            </div>
            
            <!-- 编辑模式 -->
            <div v-if="!showPreview" class="editor-content">
              <textarea v-model="formData.description" 
                rows="18"
                placeholder="请输入作品描述（支持Markdown）"
                ref="contentEditor"
              ></textarea>
            </div>
            
            <!-- 预览模式 -->
            <div v-else class="preview-content">
              <div class="preview-header">预览</div>
              <div class="preview-body" v-html="renderedDescription"></div>
            </div>
          </div>
  
          <div class="form-item">
            <label>标签</label>
            <div class="tag-input">
              <input 
                v-model="newTag"
                @keydown.enter.prevent="addTag"
                @keydown.comma.prevent="addTag"
                placeholder="输入标签后回车">
              <div class="tags">
                <span 
                  v-for="tag in formData.tags" 
                  :key="tag" 
                  class="tag">
                  {{ tag }}
                  <span class="tag-remove" @click="removeTag(tag)">×</span>
                </span>
              </div>
            </div>
          </div>
  
          <div class="form-item">
            <label>图片</label>
            <div class="image-uploader">
              <input 
                type="file" 
                multiple 
                accept="image/*"
                @change="handleImageUpload">
              <div 
                class="preview-images"
                @dragover.prevent
                @drop.prevent="handleDrop">
                <div 
                  v-for="(img, index) in formData.pictures" 
                  :key="index"
                  class="preview-item"
                  draggable="true"
                  @dragstart="handleDragStart($event, index)"
                  @dragenter.prevent="handleDragEnter($event, index)"
                  @dragend="handleDragEnd"
                  @touchstart="handleTouchStart($event, index)"
                  @touchmove.prevent="handleTouchMove($event)"
                  @touchend="handleTouchEnd">
                  <img v-image="img" class="interactive-image">
                  <span class="remove" @click="removePicture(index)">×</span>
                  <div class="drag-handle">⋮⋮</div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-item">
            <label>视频</label>
            <div class="video-uploader" @click="triggerVideoUpload">
              <input 
                type="file" 
                accept="video/*"
                @change="handleVideoUpload"
                class="video-file-input"
                ref="videoInput">
              
              <!-- 视频预览 -->
              <div v-if="formData.video" class="video-preview">
                <video 
                  v-video="formData.video" 
                  controls 
                  class="video-player">
                  您的浏览器不支持视频播放
                </video>
                <button 
                  type="button" 
                  @click.stop="removeVideo" 
                  class="remove-video-btn">
                  ×
                </button>
              </div>
              
            </div>
          </div>

          <div class="form-item">
            <label>链接</label>
            <input 
              v-model="formData.link" 
              type="url" 
              placeholder="请输入购买链接（可选）"
              class="link-input">
          </div>

          <div class="form-item">
            <label>价格</label>
            <div class="price-input">
              <span class="currency-symbol">¥</span>
              <input 
                v-model="formData.price" 
                type="text" 
                placeholder="请输入价格（可选）"
                @input="handlePriceInput"
                class="price-field">
            </div>
            <div class="price-hint">留空表示价格待定</div>
            
            <!-- 材料成本显示 -->
            <div v-if="calculateMaterialCost > 0" class="cost-info">
              <span class="cost-label">材料成本:</span>
              <span class="cost-value">¥{{ formatPrice(calculateMaterialCost) }}</span>
            </div>
          </div>
  
          <div class="form-item">
            <label>材料信息</label>
            <div class="selected-materials">
              <div v-for="material in selectedMaterials" :key="material.id" class="material-tag">
                <div class="material-content" @click="editMaterialQuantity(material)">
                  <div class="material-header">
                    <span class="material-name">{{ material.name }}</span>
                    <span class="material-quantity">×{{ material.quantity }}</span>
                  </div>
                  <div class="material-details">
                    <span v-if="material.substance" class="detail-item substance">{{ material.substance }}</span>
                    <span v-if="material.color" class="detail-item color">{{ material.color }}</span>
                    <span v-if="material.size" class="detail-item size">{{ material.size }}</span>
                    <span v-if="material.shape" class="detail-item shape">{{ material.shape }}</span>
                    <span v-if="material.price" class="detail-item price">{{ material.price }}</span>
                  </div>
                </div>
                <button type="button" @click.stop="removeMaterial(material)" class="remove-btn">×</button>
              </div>
              <button type="button" @click="toggleMaterialSelector" class="add-material-btn">
                 添加材料
              </button>
            </div>
            
            <!-- 数量输入界面 -->
            <div v-if="editingMaterial" class="quantity-input-modal" @click="closeModalOnBackground">
              <div class="quantity-input-content" @click.stop>
                <h4>{{ isEditingExisting ? '编辑材料数量' : '添加材料' }}：{{ editingMaterial.name }}</h4>
                <div class="quantity-input-group">
                  <label>数量：</label>
                  <input 
                    v-model.number="materialQuantity" 
                    type="number" 
                    min="1" 
                    class="quantity-input"
                  >
                </div>
                <div class="quantity-actions">
                  <button type="button" @click="confirmAddMaterial" class="btn primary">{{ isEditingExisting ? '更新' : '确认' }}</button>
                  <button type="button" @click="cancelAddMaterial" class="btn secondary">取消</button>
                </div>
              </div>
            </div>
            
            <!-- 材料选择器 -->
            <div v-if="showMaterialSelector" class="material-selector">
              <div class="search-container">
                <div class="search-fields">
                  <!-- 类型搜索 -->
                  <div class="search-field">
                    <div class="type-selector">
                      <div 
                        class="type-input" 
                        @click="showTypeDropdown = !showTypeDropdown">
                        <span v-if="materialSearchQuery.type.length">{{ selectedTypes }}</span>
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
                              'selected': materialSearchQuery.type.includes(option.value),
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
                  <!-- 名称搜索 -->
                  <div class="search-field">
                    <input 
                      v-model="materialSearchQuery.name" 
                      placeholder="搜索名称"
                      class="search-input"
                    >
                  </div>
                  
                  
                  <!-- 材质搜索 -->
                  <div class="search-field">
                    <input 
                      v-model="materialSearchQuery.substance" 
                      placeholder="材质"
                      class="search-input"
                    >
                  </div>
                  
                  <!-- 颜色搜索 -->
                  <div class="search-field">
                    <input 
                      v-model="materialSearchQuery.color" 
                      placeholder="颜色"
                      class="search-input"
                    >
                  </div>
                  
                  <!-- 形状搜索 -->
                  <div class="search-field">
                    <input 
                      v-model="materialSearchQuery.shape" 
                      placeholder="形状"
                      class="search-input"
                    >
                  </div>
                  
                  <!-- 尺寸搜索 -->
                  <div class="search-field">
                    <input 
                      v-model="materialSearchQuery.size" 
                      placeholder="尺寸"
                      class="search-input"
                    >
                  </div>
                </div>
                
                <div class="search-hint">{{ searchHint }}</div>
              </div>
              
              <div class="material-list">
                <div 
                  v-for="material in filteredMaterials" 
                  :key="material.id" 
                  class="material-item"
                  @click="selectMaterial(material)"
                >
                  <div class="material-name">{{ material.name }}</div>
                  <div class="material-details">
                    <span v-if="material.substance" class="detail-item substance">{{ material.substance }}</span>
                    <span v-if="material.color" class="detail-item color">{{ material.color }}</span>
                    <span v-if="material.size" class="detail-item size">{{ material.size }}</span>
                    <span v-if="material.shape" class="detail-item shape">{{ material.shape }}</span>
                  </div>
                </div>
                <div v-if="filteredMaterials.length === 0 && materialSearchQuery.name" class="no-results">
                  没有找到匹配的材料
                </div>
              </div>
            </div>
          </div>

          <div class="form-item">
            <label>完成状态</label>
            <div class="status-selector">
              <label class="status-option">
                <input 
                  type="radio" 
                  :value="0" 
                  v-model="formData.status"
                  name="status">
                <span>未完成</span>
              </label>
              <label class="status-option">
                <input 
                  type="radio" 
                  :value="1" 
                  v-model="formData.status"
                  name="status">
                <span>已完成</span>
              </label>
            </div>
          </div>
  
          <div class="form-actions">
            <button type="submit" class="btn primary" :disabled="submitting">
              {{ submitting ? '保存中...' : '保存' }}
            </button>
            <button type="button" class="btn secondary" @click.prevent="cancel">取消</button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>
  
<style scoped>
/* 编辑表单样式 */
.form-item {
  margin-bottom: 20px;
}
  
.form-item label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
}
  
.form-item input,
.form-item textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
  
.tag-input {
  margin-top: 10px;
}
  
.preview-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
  margin-top: 10px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
  min-height: 120px; /* 确保空时也有拖放区域 */
}
  
.preview-item {
  position: relative;
  aspect-ratio: 1;
  cursor: move; /* 指示可拖动 */
  transition: transform 0.2s;
}
  
.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.preview-item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.preview-item:hover .drag-handle {
  opacity: 1;
}

.drag-handle {
  position: absolute;
  bottom: 5px;
  right: 5px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: move;
  user-select: none;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}

.tag {
  padding: 2px 5px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
}
  
.remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  background: #ff4444;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.tag-remove {
  cursor: pointer;
}
  
.form-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 30px;
  border-top: 1px solid var(--color-border-soft);
}

.selected-materials {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.material-tag {
  display: flex;
  flex-direction: column;
  background-color: var(--color-background-soft);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.9em;
  position: relative;
  min-width: 100px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.material-tag:hover {
  background-color: var(--color-background);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.edit-hint {
  position: absolute;
  bottom: 2px;
  left: 8px;
  font-size: 0.7em;
  color: var(--color-text-light);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.material-tag:hover .edit-hint {
  opacity: 1;
}

.material-content {
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.material-header {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.material-name {
  font-weight: bold;
}

.material-quantity {
  font-weight: bold;
  color: var(--color-blue);
  background-color: var(--color-background-soft);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}

.material-list .material-name {
  float: left;
  font-size: 0.8rem;
  min-width: 80px;
  margin-right: 10px;
}

.material-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.75rem;
}

.detail-item {
  display: inline-flex;
  align-items: center;
}

.material-list .material-details {
  flex-direction: row;
}

.material-list .detail-item {
  margin-right: 10px;
}

.detail-item.substance {
  color: #1976d2;
}

.detail-item.color {
  color: #388e3c;
}

.detail-item.shape {
  color: #f57c00;
}

.detail-item.size {
  color: #8e24aa;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1em;
  color: var(--color-text-light);
  padding: 0 4px;
}

.add-material-btn {
  background: none;
  border: 1px dashed var(--color-border);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9em;
}

.material-selector {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  margin-top: 10px;
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.search-container {
  padding: 8px 8px 0 8px;
  border-bottom: 1px solid var(--color-border);
}

.search-fields {
  display: flex;
  gap: 10px;
  font-size: 0.8rem;
  flex-wrap: wrap;
}

.search-field input {
  max-width: 100px;
  padding: 5px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.8rem;
}

/* 类型选择器样式 */
.type-selector {
  position: relative;
  min-width: 120px;
}

.type-input {
  padding: 4px 5px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  line-height: normal;
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
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid var(--color-border);
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

.type-option:hover {
  background-color: #f5f7fa;
}

.type-option.selected {
  background-color: #ecf5ff;
  color: #409EFF;
  font-weight: 500;
  border-left-color: #409EFF;
}

.search-hint {
  font-size: 0.8em;
  color: #ddd;
  margin-top: 4px;
  padding: 0 4px;
}

.material-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: white;
}

.material-item {
  padding: 8px 10px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.material-item:hover {
  background-color: var(--color-background-soft);
}

.material-item:last-child {
  border-bottom: none;
}

.btn {
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.btn:active {
  transform: translateY(0);
}

.btn.primary {
  background-color: var(--color-blue);
  color: white;
}

.btn.primary:hover {
  background-color: var(--color-primary-dark, #2980b9);
}

.btn.primary:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn.secondary {
  background-color: #b4b4b4;
  color: #fff;
}
  
@media (max-width: 768px) {
    
  .image-uploader {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}

.price-input {
  position: relative;
  display: flex;
  align-items: center;
}

.currency-symbol {
  position: absolute;
  left: 10px;
  color: #666;
  font-weight: 500;
}

.price-field {
  padding-left: 25px !important;
}

.price-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.link-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* 视频上传样式 */
.video-uploader {
  padding: 10px;
  border: 2px dashed #ddd;
  border-radius: 8px;
  text-align: center;
  background: #fafafa;
  transition: all 0.3s ease;
}

.video-uploader:hover {
  border-color: #007bff;
  background: #f0f8ff;
}

.video-file-input {
  display: none;
}

.video-preview {
  position: relative;
  display: inline-block;
}

.video-player {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.remove-video-btn {
  position: absolute;
  top: -9px;
  right: -10px;
  width: 20px;
  height: 20px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
}

.video-upload-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #666;
  cursor: pointer;
  pointer-events: none;
}

.video-upload-hint i {
  font-size: 48px;
  color: #ccc;
}

.video-upload-hint span {
  font-size: 14px;
}

.cost-info {
  margin-top: 6px;
  padding: 4px 12px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #28a745;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cost-label {
  color: #666;
  font-weight: 500;
}

.cost-value {
  color: #28a745;
  font-weight: bold;
}

/* 状态选择器样式 */
.status-selector {
  display: flex;
  gap: 20px;
  margin-top: 8px;
}

.status-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
}

.status-option input[type="radio"] {
  cursor: pointer;
  width: 16px;
  height: 16px;
  margin: 0;
  vertical-align: middle;
  flex-shrink: 0;
}

.status-option span {
  user-select: none;
  padding-left: 5px;
  font-size: 0.8rem;
  line-height: normal;
  white-space: nowrap;
}

/* 数量输入界面样式 */
.quantity-input-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  backdrop-filter: blur(2px);
}

.quantity-input-content {
  background: white;
  padding: 14px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 300px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.quantity-input-content h4 {
  margin: 0 0 15px 0;
  color: var(--color-text);
  font-size: 0.9rem;
}

.quantity-input-group {
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.quantity-input-group label {
  font-weight: 500;
  margin: 0;
}

.quantity-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 1em;
}

.quantity-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.quantity-actions .btn {
  padding: 4px 10px;
  font-size: 0.9em;
}

/* 预览相关样式 */
.preview-btn {
  background-color: var(--color-blue);
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  cursor: pointer;
}

.preview-btn:hover {
  background-color: var(--color-primary-dark, #2980b9);
}

.editor-content textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
}

.preview-content {
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.preview-header {
  background: #f5f5f5;
  padding: 8px 12px;
  border-bottom: 1px solid #ddd;
  font-size: 0.9em;
  font-weight: 500;
  color: #666;
}

.preview-body {
  padding: 12px;
  min-height: 200px;
  line-height: 1.6;
}

.preview-body :deep(p) {
  margin-bottom: 8px;
}

.preview-body :deep(h1),
.preview-body :deep(h2),
.preview-body :deep(h3) {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: bold;
}

.preview-body :deep(h1) {
  font-size: 1.2em;
}

.preview-body :deep(h2) {
  font-size: 1.1em;
}

.preview-body :deep(h3) {
  font-size: 1em;
}

.preview-body :deep(blockquote) {
  margin: 8px 0;
  padding: 8px 12px;
  background: #f9f9f9;
  border-left: 3px solid #ddd;
  font-style: italic;
}

.preview-body :deep(ul),
.preview-body :deep(ol) {
  margin: 8px 0;
  padding-left: 20px;
}

.preview-body :deep(li) {
  margin-bottom: 4px;
}

.preview-body :deep(a) {
  color: var(--color-blue);
  text-decoration: underline;
}

.preview-body :deep(strong) {
  font-weight: bold;
}

.preview-body :deep(em) {
  font-style: italic;
}

</style>