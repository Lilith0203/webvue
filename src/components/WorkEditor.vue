<!-- components/WorkEditor.vue -->
<script setup>
import { ref, reactive, onMounted } from 'vue'
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
      tags: []
    })
  },
  mode: {
    type: String,
    default: 'create' // 'create' 或 'edit'
  }
})

const emit = defineEmits(['cancel', 'success'])

const initFormData = () => {
  return {
    id: props.work?.id || null,
    name: props.work?.name || '',
    description: props.work?.description || '',
    pictures: [...(props.work?.pictures || [])],
    tags: [...(props.work?.tags || [])]
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
        formData.pictures.push(response.data.url)
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

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return
  
  submitting.value = true
  try {
    const url = props.mode === 'create' ? '/works/add' : `/works/edit`
    const method = 'post'

    // 确保发送的数据格式正确
    const submitData = {
      ...formData,
      id: props.mode === 'create' ? null : formData.id,
      pictures: formData.pictures || [],
      tags: formData.tags || []
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
        const images = [...formData.value.pictures]
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
})
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
                placeholder="输入标签后回车"
              >
              <div class="tags">
                <span 
                  v-for="tag in formData.tags" 
                  :key="tag" 
                  class="tag"
                >
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
                @change="handleImageUpload"
              >
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
                  @touchend="handleTouchEnd"
                >
                  <img v-image="img" class="interactive-image">
                  <span class="remove" @click="removePicture(index)">×</span>
                  <div class="drag-handle">⋮⋮</div>
                </div>
              </div>
            </div>
          </div>
  
          <div class="form-actions">
            <button type="submit" :disabled="submitting">保存</button>
            <button type="button" @click.prevent="cancel">取消</button>
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
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }
  
  @media (max-width: 768px) {
    .work-editor {
      padding: 10px;
    }
    
    .image-uploader {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    }
  }
  </style>