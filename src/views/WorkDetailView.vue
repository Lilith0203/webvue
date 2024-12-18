<template>
    <div class="work-detail">
      <!-- 返回按钮 -->
      <button class="back-btn" @click="router.back()">返回</button>
  
      <div v-if="work" class="work-content">
        <!-- 作品标题和操作按钮 -->
        <div class="header">
          <h2>{{ work.name }}</h2>
          <button v-if="!isEditing && canEdit" @click="startEdit">编辑</button>
        </div>
  
        <!-- 编辑表单 -->
        <form v-if="isEditing" @submit.prevent="saveWork">
          <div class="form-item">
            <label>名称</label>
            <input v-model="editForm.name" required>
          </div>
  
          <div class="form-item">
            <label>描述</label>
            <textarea v-model="editForm.description" rows="4"></textarea>
          </div>
  
          <div class="form-item">
            <label>标签</label>
            <div class="tag-input">
              <input 
                v-model="newTag"
                @keyup.enter="addTag"
                placeholder="输入标签后回车"
              >
              <div class="tags">
                <span 
                  v-for="tag in editForm.tags" 
                  :key="tag" 
                  class="tag"
                >
                  {{ tag }}
                  <span class="remove" @click="removeTag(tag)">×</span>
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
                  v-for="(img, index) in editForm.pictures" 
                  :key="index"
                  class="preview-item"
                  draggable="true"
                  @dragstart="handleDragStart($event, index)"
                  @dragenter.prevent="handleDragEnter($event, index)"
                  @dragend="handleDragEnd"
                >
                  <img :src="img">
                  <span class="remove" @click="removeImage(index)">×</span>
                  <div class="drag-handle">⋮⋮</div>
                </div>
              </div>
            </div>
          </div>
  
          <div class="form-actions">
            <button type="submit">保存</button>
            <button type="button" @click="cancelEdit">取消</button>
          </div>
        </form>
  
        <!-- 作品展示 -->
        <template v-else>
          <!-- 图片画廊 -->
          <div class="gallery">
            <div class="gallery-main">
              <img :src="currentImage" alt="主图">
              <button 
                class="gallery-nav prev" 
                @click="prevImage"
                v-show="currentImageIndex > 0"
              >
                ‹
              </button>
              <button 
                class="gallery-nav next" 
                @click="nextImage"
                v-show="currentImageIndex < work.pictures.length - 1"
              >
                ›
              </button>
            </div>
            
            <div class="gallery-thumbs">
              <div 
                v-for="(img, index) in work.pictures" 
                :key="index"
                class="thumb"
                :class="{ active: index === currentImageIndex }"
                @click="selectImage(index)"
              >
                <img :src="img" :alt="`缩略图 ${index + 1}`">
              </div>
            </div>
          </div>
  
          <!-- 作品信息 -->
          <div class="work-info">
            <p class="description">{{ work.description }}</p>
            
            <div class="tags">
              <span 
                v-for="tag in work.tags" 
                :key="tag" 
                class="tag"
              >
                {{ tag }}
              </span>
            </div>
  
            <div class="update-time">
              更新时间: {{ formatDate(work.updatedAt) }}
            </div>
          </div>
        </template>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import axios from '../api'
  import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
//判断是否有编辑权限
const canEdit = computed(() => {
    return authStore.isAuthenticated
})
  
  const router = useRouter()
  const route = useRoute()
  const work = ref(null)
  const isEditing = ref(false)
  const currentImageIndex = ref(0)
  const newTag = ref('')
  // 拖拽相关状态
const dragIndex = ref(null)
const dragTarget = ref(null)

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
  const pictures = [...editForm.value.pictures]
  const [removed] = pictures.splice(dragIndex.value, 1)
  pictures.splice(index, 0, removed)
  editForm.value.pictures = pictures
  dragIndex.value = index
}

// 拖拽结束
const handleDragEnd = (e) => {
  dragIndex.value = null
  dragTarget.value = null
  e.target.classList.remove('dragging')
}

// 处理拖放（用于移动设备）
const handleDrop = (e) => {
  e.preventDefault()
}
  
  // 编辑表单
  const editForm = ref({
    name: '',
    description: '',
    tags: [],
    pictures: []
  })
  
  // 当前显示的图片
  const currentImage = computed(() => {
    return work.value?.pictures[currentImageIndex.value]
  })
  
  // 获取作品详情
  const fetchWorkDetail = async () => {
    try {
      const response = await axios.get(`/works/${route.params.id}`)
      work.value = response.data.works
      currentImageIndex.value = 0
    } catch (error) {
      console.error('获取作品详情失败:', error)
    }
  }
  
  // 开始编辑
  const startEdit = () => {
    editForm.value = { ...work.value }
    isEditing.value = true
  }
  
  // 取消编辑
  const cancelEdit = () => {
    isEditing.value = false
    editForm.value = { ...work.value }
  }
  
  // 保存编辑
  const saveWork = async () => {
    try {
      await axios.post(`/works/edit`, editForm.value)
      work.value = { ...editForm.value }
      isEditing.value = false
    } catch (error) {
      console.error('保存失败:', error)
    }
  }
  
  // 图片相关操作
  const prevImage = () => {
    if (currentImageIndex.value > 0) {
      currentImageIndex.value--
    }
  }
  
  const nextImage = () => {
    if (currentImageIndex.value < work.value.pictures.length - 1) {
      currentImageIndex.value++
    }
  }
  
  const selectImage = (index) => {
    currentImageIndex.value = index
  }
  
  // 标签相关操作
  const addTag = () => {
    if (newTag.value && !editForm.value.tags.includes(newTag.value)) {
      editForm.value.tags.push(newTag.value)
    }
    newTag.value = ''
  }
  
  const removeTag = (tag) => {
    editForm.value.tags = editForm.value.tags.filter(t => t !== tag)
  }
  
  // 图片上传相关操作
  const handleImageUpload = async (event) => {
    const files = event.target.files
    if (!files.length) return

    try {
      for (let file of files) {
        let formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'works');
        let response = await axios.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
        })
        editForm.value.pictures.push(response.data.url)
      }

    } catch (error) {
      console.error('上传图片失败:', error)
    }
  }
  
  const removeImage = (index) => {
    editForm.value.pictures.splice(index, 1)
  }
  
  // 格式化日期
  const formatDate = (date) => {
    return new Date(date).toLocaleString()
  }
  
  onMounted(() => {
    fetchWorkDetail()
  })
  </script>
  
  <style scoped>
  .work-detail {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  .back-btn {
    margin-bottom: 20px;
    padding: 8px 16px;
    background: #f4f4f5;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .gallery {
    margin-bottom: 30px;
  }
  
  .gallery-main {
    position: relative;
    aspect-ratio: 16/9;
    background: #f5f5f5;
    margin-bottom: 10px;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .gallery-main img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  
  .gallery-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0,0,0,0.5);
    color: white;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .gallery-nav.prev {
    left: 10px;
  }
  
  .gallery-nav.next {
    right: 10px;
  }
  
  .gallery-thumbs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 10px;
  }
  
  .thumb {
    aspect-ratio: 1;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.3s;
  }
  
  .thumb:hover,
  .thumb.active {
    opacity: 1;
  }
  
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .work-info {
    margin-top: 30px;
  }
  
  .description {
    white-space: pre-line;
    line-height: 1.6;
    color: #333;
  }
  
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 15px 0;
  }
  
  .tag {
    padding: 4px 8px;
    background-color: #f0f0f0;
    border-radius: 4px;
    font-size: 12px;
  }
  
  .update-time {
    color: #999;
    font-size: 12px;
  }
  
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
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }
  
  @media (max-width: 768px) {
    .gallery-main {
      aspect-ratio: 4/3;
    }
  
    .gallery-thumbs {
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    }

    .preview-item {
    touch-action: none; /* 防止触摸设备的默认行为 */
  }
  
  .drag-handle {
    opacity: 1; /* 在移动端始终显示拖动手柄 */
    padding: 4px 8px; /* 更大的点击区域 */
  }
  }
  </style>