<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import WorkEditor from '../components/WorkEditor.vue'
import { confirm } from '../utils/confirm'

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
const showEditor = ref(false)
const editorMode = ref('create')
const currentWork = ref(null)

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

// 打开新建编辑器
const openCreateEditor = () => {
  currentWork.value = null
  editorMode.value = 'create'
  showEditor.value = true
}

// 打开编辑编辑器
const openEditEditor = (work) => {
  currentWork.value = work
  editorMode.value = 'edit'
  showEditor.value = true
}

// 处理编辑成功
const handleEditorSuccess = (work) => {
  // 更新列表数据
  showEditor.value = false
}

// 关闭编辑器
const closeEditor = () => {
  showEditor.value = false
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
  currentWork.value = {
    id: null,
    name: '',
    description: '',
    tags: [],
    pictures: []
  }
  showEditor.value = true
}

// 显示编辑作品弹窗
const editWork = (work) => {
  isEditing.value = true
  currentWork.value = { ...work }
  showEditor.value = true
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
  const confirmed = await confirm('确定要删除这个作品吗？')
  if (!confirmed) {
    return
  }
  
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

onUnmounted(() => {
})
</script>

<template>
  
    <WorkEditor 
      v-if="showEditor"
      :visible="showEditor"
      :mode="editorMode"
      :work="currentWork"
      @success="handleEditorSuccess"
      @cancel="closeEditor"
    /><!-- 编辑弹窗 -->
    <template v-else>
      <div class="header">
        <h2>作品展示</h2>
        <button v-if="canEdit" class="add-btn" @click="openCreateEditor">新增 +</button>
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
            v-image="work.pictures[0]" alt="封面">
            <div v-else class="no-image">
              暂无图片
            </div>
          </div>
          
          <!-- 作品信息 -->
          <div class="work-info">
            <div class="work-header">
              <h3 @click="goToDetail(work.id)">{{ work.name }}</h3>
              <!-- 操作按钮 -->
              <div class="actions" v-if="canEdit">
                <button @click="openEditEditor(work)"><i class="iconfont icon-bianji"></i></button>
                <button @click="deleteWork(work.id)"><i class="iconfont icon-shanchu"></i></button>
              </div>
            </div>
            <!--<p class="description">{{ work.description }}</p>-->
            <div class="tags">
              <span 
                v-for="tag in work.tags" 
                :key="tag" 
                class="tag"
              >
                <a>{{ tag }}</a>
              </span>
            </div>
            <div class="update-time">
              更新时间: {{ formatDate(work.updatedAt) }}
            </div>
          </div>
        </div>
      </div>
    </template>
</template>

<style scoped>
.work-view {
  padding: 20px 0;
  max-width: 1200px;
  margin: 30px auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  font-size: 1rem;
  font-weight: bold;
}

.add-btn {
  padding: 4px 6px;
  background-color: var(--color-blue);
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
  padding: 10px 15px;
  font-size: 1rem;
}

.work-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.work-info h3 {
  font-size: 1rem;
  cursor: pointer;
}

.description {
  color: #666;
  margin: 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
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
  padding: 2px 5px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
}

.update-time {
  font-size: 12px;
  color: #999;
}

.actions {
  display: flex;
  gap: 10px;
}

.actions button {
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.actions button:hover {
  border: 1px dashed #ddd;
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

.tag-remove {
  cursor: pointer;
}

@media (max-width: 768px) {
  .work-view {
    margin-top: 0;
  }

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