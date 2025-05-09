<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import WorkEditor from '../components/WorkEditor.vue'
import { marked } from 'marked'
import CommentSection from '../components/CommentSection.vue'
import { confirm } from '../utils/confirm'

// 修改 marked 渲染器配置
const renderer = new marked.Renderer()

const authStore = useAuthStore()
//判断是否有编辑权限
const canEdit = computed(() => {
    return authStore.isAuthenticated
})
  
const router = useRouter()
const route = useRoute()
const work = ref(null)
const currentImageIndex = ref(0)
const editorMode = ref('edit')
const showEditor = ref(false)
const currentWork = ref(null)
const comments = ref([])  // 存储评论
const loadingComments = ref(false)
const errorComments = ref(null)
const materials = ref([])  // 存储材料信息

// 交互数据
const interactions = ref({
  like: 0,
  weight: 0
})
const hasLiked = ref(false)
const hasRecommended = ref(false)

const fetchComments = async (itemId) => {
  loadingComments.value = true
  errorComments.value = null

  try {
    const response = await axios.get(`/comments/${itemId}`, {
      params: {
        type: 2,
      }
    })
    comments.value = response.data.comments  // 假设返回的评论数据在 comments 字段中
  } catch (error) {
    errorComments.value = "获取评论失败：" + error.message
    console.error('Fetch comments error:', error)
  } finally {
    loadingComments.value = false
  }
}

// 提交评论
const submitComment = async (commentData) => {
  try {
    const response = await axios.post('/comment', {
      name: commentData.name,
      content: commentData.content,
      type: 2,
      itemId: work.value.id,
      reply: commentData.reply
    })
    if (!response.data.success) {
      message.alert(response.data.message)
      return
    }
    comments.value.push(response.data.data.comment)  // 假设返回的评论数据在 comment 字段中
  } catch (error) {
    console.error('提交评论失败:', error)
    message.alert('提交评论失败：' + error.message)
  }
}

const deleteComment = async(commentId) => {
  if (await confirm('确定要删除吗？')) {
    try {
      await axios.post(`/comment_delete`, {id:commentId})
    } catch (error) {
      console.error('删除失败:', error)
    } finally {
      await fetchComments(work.value.id)
    }
  }
}

// 处理编辑成功
const handleEditorSuccess = (work) => {
  // 更新列表数据
  showEditor.value = false
  fetchWorkDetail()
}

// 关闭编辑器
const closeEditor = () => {
  showEditor.value = false
}
  
// 当前显示的图片
const currentImage = computed(() => {
  return work.value?.pictures[currentImageIndex.value]
})
  
// 获取作品详情
const fetchWorkDetail = async () => {
  try {
    const response = await axios.get(`/works/${route.params.id}`)
    work.value = response.data.works
    work.value.renderedContent = await marked(work.value.description)
    currentImageIndex.value = 0
      
    // 如果有材料信息，获取材料详情
    if (work.value.materials && work.value.materials.length > 0) {
      fetchMaterials(work.value.materials)
    }
  } catch (error) {
    console.error('获取作品详情失败:', error)
  }
}
  
// 获取材料信息
const fetchMaterials = async (materialIds) => {
  try {
    const response = await axios.post('/material', {
      ids: materialIds
    })
    materials.value = response.data.materials
  } catch (error) {
    console.error('获取材料信息失败:', error)
  }
}
  
// 开始编辑
const startEdit = (work) => {
  currentWork.value = work
  editorMode.value = 'edit'
  showEditor.value = true
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
  
// 格式化日期
const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

// 格式化价格
const formatPrice = (price) => {
  return parseFloat(price).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

  // 自定义链接渲染
renderer.link = (link) => {
  // 确保 href 是字符串
  const url = link.href || ''
  
  // 检查是否为外部链接
  const isExternal = url.startsWith('http') || url.startsWith('https')
  const attrs = [
    `href="${url}"`,
    isExternal ? 'target="_blank"' : '',  // 外部链接添加 target="_blank"
    isExternal ? 'rel="noopener noreferrer"' : '',  // 安全属性
    link.title ? `title="${title}"` : ''
  ].filter(Boolean).join(' ')
  
  return `<a ${attrs}>${link.text}</a>`
}

// 使用自定义渲染器
marked.use({ renderer })
  
// 生成唯一ID的函数
const generateClientId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 获取或创建客户端ID
const getClientId = () => {
  let clientId = localStorage.getItem('clientId');
  if (!clientId) {
    clientId = generateClientId();
    localStorage.setItem('clientId', clientId);
  }
  return clientId;
}

// 获取交互数据
const fetchInteractions = async () => {
  try {
    const response = await axios.get(`/interaction/2/${work.value.id}/${getClientId()}`)
    if (response.data.success) {
      interactions.value = response.data.data
      hasLiked.value = response.data.data.hasLiked || false
      hasRecommended.value = response.data.data.hasRecommended || false
    }
  } catch (error) {
    console.error('获取交互数据失败:', error)
  }
}

// 点赞
const toggleLike = async () => {
  try {
    const response = await axios.post('/interaction/like', {
      type: 2,
      itemId: work.value.id,
      clientId: getClientId()
    })
    
    if (response.data.success) {
      // 更新状态
      hasLiked.value = response.data.data.hasLiked
      interactions.value.like = response.data.data.like
    }
  } catch (error) {
    console.error('点赞失败:', error)
  }
}

// 推荐
const toggleRecommend = async () => {
  if (!authStore.isAuthenticated) {
    return
  }
  
  try {
    await axios.post('/interaction/recommend', {
      type: 2,
      itemId: work.value.id,
      weight: hasRecommended.value ? 0 : 10 // 如果已推荐，则取消推荐
    })
    
    // 更新状态
    hasRecommended.value = !hasRecommended.value
    interactions.value.weight = hasRecommended.value ? 10 : 0
  } catch (error) {
    console.error('推荐失败:', error)
  }
}

const handleBack = () => {
  // 如果是从列表页进入的，返回到列表页并带上 from=detail 参数
  if (route.query.from === 'list') {
    router.push({
      path: '/works',
      query: { from: 'detail' }
    })
  } else {
    // 如果是从其他详情页进入的，使用浏览器的后退功能
    router.back()
  }
}

onMounted(async() => {
  await fetchWorkDetail()
  const itemId = work.value.id
  await fetchComments(itemId)
  await fetchInteractions()
})
</script>

<template>
  <div class="work-detail">
  
    <div v-if="work" class="work-content">
      <!-- 编辑表单 -->
      <WorkEditor 
        v-if="showEditor"
        :visible="showEditor"
        :mode="editorMode"
        :work="currentWork"
        @success="handleEditorSuccess"
        @cancel="closeEditor"/>
  
      <!-- 作品展示 -->
      <template v-else>
        <!-- 作品标题和操作按钮 -->
        <a @click="handleBack()" class="a-back"><i class="iconfont icon-back"></i></a>
        <div class="header">
          <h2>{{ work.id }} {{ work.name }}</h2>
          <div v-if="canEdit" @click="startEdit(work)"><i class="iconfont icon-bianji"></i></div>
        </div>

        <!-- 交互区域 -->
        <div class="interaction-area">
            <div class="interaction-btn" @click="toggleLike">
              <i :class="['iconfont', hasLiked ? 'icon-dianzan' : 'icon-dianzan-0']"></i>
              <span>{{ interactions.like }}</span>
            </div>
            
            <div v-if="canEdit" class="interaction-btn" @click="toggleRecommend">
              <i :class="['iconfont', interactions.weight > 0 ? 'icon-xingxingtuijian1' : 'icon--xingxingtuijian']"></i>
              <span v-if="interactions.weight > 0">已推荐</span>
              <span v-else>推荐</span>
            </div>
          </div>
        
        <!-- 图片画廊 -->
        <div class="gallery">
          <div class="gallery-main">
            <img v-image="currentImage" alt="主图">
            <button 
              class="gallery-nav prev" 
              @click="prevImage"
              v-show="currentImageIndex > 0">
              <i class="iconfont icon-zuojiantou"></i>
            </button>
            <button 
              class="gallery-nav next" 
              @click="nextImage"
              v-show="currentImageIndex < work.pictures.length - 1">
              <i class="iconfont icon-youjiantou"></i>
            </button>
          </div>
            
          <div class="gallery-thumbs">
            <div 
              v-for="(img, index) in work.pictures" 
              :key="index"
              class="thumb"
              :class="{ active: index === currentImageIndex }"
              @click="selectImage(index)">
              <img v-image="img" :alt="`缩略图 ${index + 1}`">
            </div>
          </div>
        </div>
  
        <!-- 作品信息 -->
        <div class="work-info">
          <div class="tags">
            <span 
              v-for="tag in work.tags" 
              :key="tag" 
              class="tag">
              <a>{{ tag }}</a>
            </span>
          </div>
          
          <div class="description" v-html="work.renderedContent"></div>  

          <!-- 价格信息 -->
          <div v-if="work.price" class="price-info">
            <span class="price-label">价格:</span>
            <span class="price-value">¥{{ formatPrice(work.price) }}</span>
          </div>

          <!-- 材料信息 -->
          <div v-if="materials.length > 0" class="materials-section">
            <h3>材料信息</h3>
            <div class="materials-list">
              <div 
                v-for="material in materials" 
                :key="material.id"
                class="material-item">
                
                <span class="material-name">{{ material.name }}</span>
                <span v-if="material.substance" class="material-info">{{ material.substance }}</span>
                <span v-if="material.size" class="material-info">{{ material.size }}</span>
                <span v-if="material.color" class="material-info">{{ material.color }}</span>
                <span v-if="material.shape" class="material-info">{{ material.shape }}</span>
              </div>
            </div>
          </div>
  
          <div class="update-time">
            更新时间: {{ formatDate(work.updatedAt) }}
          </div>
        </div>
      </template>
        
      <!-- 只在非编辑模式下显示评论 -->
      <CommentSection 
        v-if="!showEditor"
        :comments="comments" 
        :onCommentSubmit="submitComment"
        :onCommentDelete="deleteComment"/>
    </div>
  </div>
</template>
  
<style scoped>
.icon-back {
  font-size: 1.5rem;
}

.work-detail {
  padding: 40px 0 20px;
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
  align-items: center;
  margin-bottom: 0px;
}

.header div {
  margin-left: 10px;
  cursor: pointer;
  padding: 0 5px;
}

.header div:hover {
  border: 1px dashed #999;
}

.header h2 {
  font-size: 1.1rem;
  font-weight: bold;
}
  
.gallery {
  margin-bottom: 30px;
}
  
.gallery-main {
  position: relative;
  aspect-ratio: 4/3;
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
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
}

.gallery-nav i {
  font-size: 1.5rem;
  opacity: 0.4;
  font-size: 2rem;
}

.gallery-nav i:hover {
  opacity: 1;
}
  
.gallery-nav.prev {
  left: 5px;
}
  
.gallery-nav.next {
  right: 5px;
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
  line-height: 1.3;
  color: #333;
  margin: 20px 10px;
}

:deep(.description p) {
  margin-bottom: 8px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 15px 0;
}
  
.tag {
  padding: 2px 6px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
}
  
.update-time {
  color: #999;
  font-size: 12px;
}

.materials-section {
  margin: 15px 0;
  padding: 15px 20px;
  background-color: var(--color-background-soft);
  border-radius: 8px;
}

.materials-section h3 {
  font-size: 0.9rem;
  margin-bottom: 5px;
  color: var(--color-text);
  border-bottom: 1px dashed #d3d3d3;
  padding-bottom: 8px;
}

.materials-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.material-item {
  font-size: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}

.material-name {
  font-weight: bold;
  margin-right: 5px;
}

.material-info {
  font-size: 0.85rem;
  white-space: nowrap;
}

/* 添加图标样式 */
.icon-material:before {
  content: "🧱";
}

.icon-size:before {
  content: "📏";
}
  
.price-info {
  margin: 10px 10px 20px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
}

.price-label {
  color: #666;
  margin-right: 8px;
}
  
.interaction-area {
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 0px 10px;
}

.interaction-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.interaction-btn i {
  font-size: 1.2rem;
}

.interaction-btn i.icon-dianzan {
  color: #e53935;
}

.interaction-btn i.icon-xingxingtuijian1 {
  color: #ffc107;
}

@media (max-width: 768px) {
  .work-detail {
    padding-top: 0;
  }

  .gallery-main {
    aspect-ratio: 1/1;
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

  .gallery-nav i {
    font-size: 1.5rem;
  }
}
</style>