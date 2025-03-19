<!-- components/WorkEditor.vue -->
<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import axios from '../api'
import { message } from '../utils/message'

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
// 选中的材料
const selectedMaterials = ref([])
// 材料搜索关键词
const materialSearchQuery = ref('')
// 是否显示材料选择器
const showMaterialSelector = ref(false)
// 是否已加载材料数据
const materialsLoaded = ref(false)
// 搜索结果数量限制
const maxSearchResults = 100

const initFormData = () => {
  return {
    id: props.work?.id || null,
    name: props.work?.name || '',
    description: props.work?.description || '',
    pictures: [...(props.work?.pictures || [])],
    tags: [...(props.work?.tags || [])],
    materials: [...(props.work?.materials || [])],
    price: props.work?.price || ''
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

// 过滤材料
const filteredMaterials = computed(() => {
  if (!materialSearchQuery.value) {
    return []
  }
  
  const query = materialSearchQuery.value.toLowerCase()
  return materials.value
    .filter(material => 
      material.name.toLowerCase().includes(query) || 
      (material.substance && material.substance.toLowerCase().includes(query)) ||
      (material.color && material.color.toLowerCase().includes(query)) ||
      (material.shape && material.shape.toLowerCase().includes(query))
    )
    .slice(0, maxSearchResults)
})

// 搜索提示信息
const searchHint = computed(() => {  
  if (!materialSearchQuery.value) {
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
    selectedMaterials.value.push(material)
    formData.materials.push(material.id)
  }
}

// 移除材料
const removeMaterial = (material) => {
  selectedMaterials.value = selectedMaterials.value.filter(m => m.id !== material.id)
  formData.materials = formData.materials.filter(id => id !== material.id)
}

// 切换材料选择器
const toggleMaterialSelector = () => {
  showMaterialSelector.value = !showMaterialSelector.value
  if (showMaterialSelector.value && !materialsLoaded.value) {
    fetchMaterials()
  }
}

// 初始化表单
const initForm = () => {
  if (props.work) {
    form.value = {
      name: props.work.name || '',
      description: props.work.description || '',
      tags: props.work.tags || [],
      pictures: props.work.pictures || [],
      materials: props.work.materials || [],
      price: props.work.price || ''
    }
    
    // 加载已选材料信息
    if (props.work.materials && props.work.materials.length > 0) {
      loadSelectedMaterials()
    }
  }
}

// 加载已选材料信息
const loadSelectedMaterials = async () => {
  try {
    const response = await axios.post('/material', {
      ids: form.value.materials
    })
    selectedMaterials.value = response.data.materials
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
      price: formData.price || 0
    }
    
    const response = await axios[method](url, submitData)
    message.success(props.mode === 'create' ? '创建成功' : '更新成功')
    emit('success', response.data.work)
  } catch (error) {
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

onMounted(() => {
  initForm()
})

// 监听 work 变化
watch(() => props.work, () => {
  initForm()
}, { deep: true })
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
            </div>
            <textarea v-model="formData.description" 
              rows="18"
              placeholder="请输入作品描述（支持Markdown）"
              ref="contentEditor"
            ></textarea>
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
          </div>
  
          <div class="form-item">
            <label>材料信息</label>
            <div class="selected-materials">
              <div v-for="material in selectedMaterials" :key="material.id" class="material-tag">
                <span class="material-name">{{ material.name }}</span>
                <div class="material-details">
                  <span v-if="material.substance" class="detail-item substance">{{ material.substance }}</span>
                  <span v-if="material.color" class="detail-item color">{{ material.color }}</span>
                  <span v-if="material.size" class="detail-item size">{{ material.size }}</span>
                  <span v-if="material.shape" class="detail-item shape">{{ material.shape }}</span>
                  <span v-if="material.price" class="detail-item price">{{ material.price }}</span>
                </div>
                <button type="button" @click="removeMaterial(material)" class="remove-btn">×</button>
              </div>
              <button type="button" @click="toggleMaterialSelector" class="add-material-btn">
                 添加材料
              </button>
            </div>
            
            <!-- 材料选择器 -->
            <div v-if="showMaterialSelector" class="material-selector">
              <div class="search-box">
                <input 
                  type="text" 
                  v-model="materialSearchQuery" 
                  placeholder="搜索材料名称、材质、颜色或形状..."
                  autofocus>
                <div class="search-hint">{{ searchHint }}</div>
              </div>
              <div class="materials-list" v-if="filteredMaterials.length > 0">
                <div 
                  v-for="material in filteredMaterials" 
                  :key="material.id"
                  class="material-item"
                  @click="selectMaterial(material)">
                  <div class="material-info">
                    <span class="material-name">{{ material.name }}</span>
                    <span v-if="material.substance" class="info-tag substance">
                      {{ material.substance }}
                    </span>
                    <span v-if="material.color" class="info-tag color">
                      {{ material.color }}
                    </span>
                    <span v-if="material.shape" class="info-tag shape">
                      {{ material.shape }}
                    </span>
                    <span v-if="material.size" class="info-tag size">
                      {{ material.size }}
                    </span>
                  </div>
                </div>
              </div>
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
  font-weight: 500;
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
  padding-top: 20px;
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
  min-width: 120px;
}

.material-name {
  font-weight: bold;
  margin-right: 10px;
}

.material-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.85em;
}

.detail-item {
  display: inline-flex;
  align-items: center;
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

.search-box {
  padding: 8px;
  border-bottom: 1px solid var(--color-border);
}

.search-box input {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.90em;
}

.search-hint {
  font-size: 0.8em;
  color: #ddd;
  margin-top: 4px;
  padding: 0 4px;
}

.materials-list {
  overflow-y: auto;
  max-height: 300px;
  padding: 8px;
}

.material-item {
  padding: 10px;
  border-bottom: 1px solid var(--color-border-soft);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.material-item:hover {
  background-color: var(--color-background-soft);
}

.material-item:last-child {
  border-bottom: none;
}

.material-info {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.info-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  background-color: var(--color-background-mute);
}

.info-tag i {
  margin-right: 4px;
  font-size: 0.9em;
}

.info-tag.substance {
  background-color: #e3f2fd;
  color: #1976d2;
}

.info-tag.color {
  background-color: #e8f5e9;
  color: #388e3c;
}

.info-tag.shape {
  background-color: #fff3e0;
  color: #f57c00;
}

.info-tag.size {
  background-color: #f3e5f5;
  color: #8e24aa;
}

.btn {
  padding: 4px 15px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
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
  background-color: white;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn.secondary:hover {
  background-color: var(--color-background-soft);
}
  
@media (max-width: 768px) {
  .work-editor {
    padding: 10px;
  }
    
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
</style>