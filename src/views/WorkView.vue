<template>
  <div class="work-view">
    <div class="header">
      <h2>作品展示</h2>
      <button v-if="canEdit" class="add-btn" @click="showAddWork">新增作品</button>
    </div>

    <!-- 作品网格展示 -->
    <div class="work-grid">
      <div 
        v-for="work in works" 
        :key="work.id" 
        class="work-card"
      >
        <!-- 封面图 -->
        <div class="work-cover" @click="goToDetail(work.id)">
          <img
          v-if="work.pictures && work.pictures.length > 0" 
          :src="work.pictures[0]" alt="封面">
          <div v-else class="no-image">
            暂无图片
          </div>
        </div>
        
        <!-- 作品信息 -->
        <div class="work-info">
          <h3>{{ work.name }}</h3>
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

        <!-- 操作按钮 -->
        <div class="actions" v-if="canEdit">
          <button @click="editWork(work)">编辑</button>
          <button @click="deleteWork(work.id)">删除</button>
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ isEditing ? '编辑作品' : '新增作品' }}</h3>
        <form @submit.prevent="saveWork">
          <div class="form-item">
            <label>名称</label>
            <input v-model="workForm.name" required>
          </div>

          <div class="form-item">
            <label>描述</label>
            <textarea v-model="workForm.description" rows="4"></textarea>
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
                  v-for="tag in workForm.tags" 
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
              <div class="preview-images"
              @dragover.prevent
              @drop.prevent="handleDrop">
                <div 
                  v-for="(img, index) in workForm.pictures" 
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
                  <img :src="img">
                  <span class="remove" @click="removeImage(index)">×</span>
                  <div class="drag-handle">⋮⋮</div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit">保存</button>
            <button type="button" @click="closeModal">取消</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
//判断是否有编辑权限
const canEdit = computed(() => {
    return authStore.isAuthenticated
})

const router = useRouter()
const works = ref([])
const showModal = ref(false)
const isEditing = ref(false)
const newTag = ref('')
// 拖拽相关状态
const dragIndex = ref(null)
const dragTarget = ref(null)
const touchStartY = ref(0)
const touchStartIndex = ref(null)
const touchElement = ref(null)
const initialY = ref(0)

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
        const images = [...workForm.value.pictures]
        const [removed] = images.splice(touchStartIndex.value, 1)
        images.splice(index, 0, removed)
        workForm.value.pictures = images
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
  const pictures = [...workForm.value.pictures]
  const [removed] = pictures.splice(dragIndex.value, 1)
  pictures.splice(index, 0, removed)
  workForm.value.pictures = pictures
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

// 表单数据
const workForm = ref({
  id: null,
  name: '',
  description: '',
  tags: [],
  pictures: []
})

// 获取作品列表
const fetchWorks = async () => {
  try {
    const response = await axios.get('/works')
    works.value = response.data.works
  } catch (error) {
    console.error('获取作品列表失败:', error)
  }
}

// 显示新增作品弹窗
const showAddWork = () => {
  isEditing.value = false
  workForm.value = {
    id: null,
    name: '',
    description: '',
    tags: [],
    pictures: []
  }
  showModal.value = true
}

// 显示编辑作品弹窗
const editWork = (work) => {
  isEditing.value = true
  workForm.value = { ...work }
  showModal.value = true
}

// 关闭弹窗
const closeModal = () => {
  showModal.value = false
  workForm.value = {
    id: null,
    name: '',
    description: '',
    tags: [],
    pictures: []
  }
}

// 保存作品
const saveWork = async () => {
  try {
    if (isEditing.value) {
      await axios.post(`/works/edit`, workForm.value)
    } else {
      await axios.post('/works/add', workForm.value)
    }
    await fetchWorks()
    closeModal()
  } catch (error) {
    console.error('保存作品失败:', error)
  }
}

// 删除作品
const deleteWork = async (id) => {
  if (!confirm('确定要删除这个作品吗？')) return
  
  try {
    await axios.post(`/works/delete`, {id:id})
    await fetchWorks()
  } catch (error) {
    console.error('删除作品失败:', error)
  }
}

// 添加标签
const addTag = () => {
  if (newTag.value && !workForm.value.tags.includes(newTag.value)) {
    workForm.value.tags.push(newTag.value)
  }
  newTag.value = ''
}

// 移除标签
const removeTag = (tag) => {
  workForm.value.tags = workForm.value.tags.filter(t => t !== tag)
}

// 处理图片上传
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
      workForm.value.pictures.push(response.data.url)
    }

  } catch (error) {
    console.error('上传图片失败:', error)
  }
}

// 移除图片
const removeImage = (index) => {
  workForm.value.pictures.splice(index, 1)
}

// 跳转到详情页
const goToDetail = (id) => {
  router.push(`/works/${id}`)
}

// 格式化日期
const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

onMounted(() => {
  fetchWorks()
})
</script>

<style scoped>
.work-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.add-btn {
  padding: 8px 16px;
  background-color: #409EFF;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.work-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s;
}

.work-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.work-cover {
  aspect-ratio: 16/9;
  overflow: hidden;
  cursor: pointer;
}

.work-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-info {
  padding: 15px;
}

.description {
  color: #666;
  margin: 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}

.tag {
  padding: 4px 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
}

.update-time {
  font-size: 12px;
  color: #999;
}

.actions {
  padding: 15px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 10px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.form-item {
  margin-bottom: 15px;
}

.form-item label {
  display: block;
  margin-bottom: 5px;
}

.form-item input,
.form-item textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
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

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
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

.no-image {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

@media (max-width: 768px) {
  .work-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
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