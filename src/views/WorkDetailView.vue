<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import WorkEditor from '../components/WorkEditor.vue'
import { marked } from 'marked'
import CommentSection from '../components/CommentSection.vue'
import { confirm } from '../utils/confirm'
import { message } from '../utils/message'
import { refreshImageUrl, refreshVideoUrl } from '../utils/image'
import { getTagColor, getTextColor, initTagColors } from '../utils/tags'

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

// 合集相关
const allSets = ref([])  // 所有合集列表
const workSets = ref([])  // 当前作品所在的合集
const loadingSets = ref(false)
const showSetSelector = ref(false)  // 是否显示合集选择器

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
        approval: 'approved'
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
      reply: commentData.reply || 0 // 如果是回复，传递回复的评论ID
    })
    if (response.data.success) {
      await fetchComments(work.value.id) // 重新获取评论
    } else {
      alert(response.data.message)
    }
  } catch (error) {
    console.error('提交评论失败:', error)
    alert('提交评论失败：' + error.message)
  }
}

const deleteComment = async(commentId) => {
  if (await confirm('确定要删除吗？')) {
    try {
      await axios.post(`/comment_delete`, {id:commentId})
      await fetchComments(work.value.id) // 重新获取评论
    } catch (error) {
      console.error('删除失败:', error)
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
  
// 所有媒体文件（图片+视频）
const allMedia = computed(() => {
  if (!work.value) return []
  
  const media = []
  
  // 添加所有图片
  if (work.value.pictures && work.value.pictures.length > 0) {
    work.value.pictures.forEach((img, index) => {
      media.push({ type: 'image', url: img, index })
    })
  }
  
  // 添加视频（如果有）
  if (work.value.video) {
    media.push({ type: 'video', url: work.value.video, index: media.length })
  }
  
  return media
})

// 当前显示的媒体
const currentMedia = computed(() => {
  return allMedia.value[currentImageIndex.value] || { type: 'image', url: '', index: 0 }
})
  
// 获取作品详情
const fetchWorkDetail = async () => {
  try {
    const response = await axios.get(`/works/${route.params.id}`)
    work.value = response.data.works
    
    if (work.value && work.value.description) {
      // 转义星号，防止被Markdown解析为斜体
      const escapedDescription = work.value.description.replace(/\*/g, '\\*')
      work.value.renderedContent = await marked(escapedDescription)
    } else {
      work.value.renderedContent = ''
    }
    
    currentImageIndex.value = 0
      
    // 如果有材料信息，获取材料详情
    if (work.value && work.value.materials && work.value.materials.length > 0) {
      fetchMaterials(work.value.materials)
    }
  } catch (error) {
    console.error('获取作品详情失败:', error)
  }
}
  
// 获取材料信息
const fetchMaterials = async (materialsData) => {
  try {
    // 提取材料ID列表
    const materialIds = materialsData.map(m => 
      typeof m === 'object' ? m.id : m
    )
    
    const response = await axios.post('/material', {
      ids: materialIds
    })
    
    // 合并材料信息和数量
    materials.value = response.data.materials.map(material => {
      const materialData = materialsData.find(m => 
        (typeof m === 'object' ? m.id : m) === material.id
      )
      return {
        ...material,
        quantity: typeof materialData === 'object' ? materialData.quantity : 1
      }
    })
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
  
// 媒体相关操作
const prevMedia = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  }
}
  
const nextMedia = () => {
  if (currentImageIndex.value < allMedia.value.length - 1) {
    currentImageIndex.value++
  }
}
  
const selectMedia = (index, type) => {
  if (type === 'image') {
    currentImageIndex.value = index
  } else if (type === 'video') {
    // 视频总是放在最后
    currentImageIndex.value = allMedia.value.length - 1
  }
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
  // 如果是从合集页进入的，返回到合集页
  if (route.query.from === 'set' && route.query.setId) {
    router.push(`/works-set/${route.query.setId}`)
  } else if (route.query.from === 'list') {
    // 如果是从列表页进入的，返回到列表页并带上 from=detail 参数
    router.push({
      path: '/works',
      query: { from: 'detail' }
    })
  } else {
    // 如果是从其他详情页进入的，使用浏览器的后退功能
    router.back()
  }
}

// 获取标签样式
const getTagStyle = (tag) => {
  const bgColor = getTagColor(tag)
  const textColor = getTextColor(bgColor)
  return {
    backgroundColor: bgColor,
    color: textColor
  }
}

// 点击标签跳转到列表页并筛选
const clickTag = (tag) => {
  router.push({
    path: '/works',
    query: { 
      tag: tag,
      page: 1,
      from: 'detail'
    }
  })
}

// 跳转到材料详情页
const goToMaterial = (materialId) => {
  const url = router.resolve({
    path: '/material',
    query: { id: materialId }
  }).href
  window.open(url, '_blank')
}

// 下载当前媒体文件
const downloadCurrentMedia = async () => {
  if (!currentMedia.value.url) return
  
  try {
    let signedUrl
    let fileName
    
    if (currentMedia.value.type === 'image') {
      // 获取带签名的图片URL
      signedUrl = await refreshImageUrl(currentMedia.value.url)
      fileName = `${work.value.name || 'work'}_${currentImageIndex.value + 1}.jpg`
    } else if (currentMedia.value.type === 'video') {
      // 获取带签名的视频URL
      signedUrl = await refreshVideoUrl(currentMedia.value.url)
      // 从URL中提取文件扩展名
      const urlObj = new URL(currentMedia.value.url)
      const pathParts = urlObj.pathname.split('.')
      const ext = pathParts.length > 1 ? pathParts[pathParts.length - 1] : 'mp4'
      fileName = `${work.value.name || 'work'}_video.${ext}`
    }
    
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isMobile) {
      // 移动端：直接跳转到文件URL
      location.href = signedUrl
    } else {
      // 桌面端：使用下载链接方式
      const link = document.createElement('a')
      link.href = signedUrl
      link.download = fileName
      link.target = '_blank'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  } catch (error) {
    console.error('下载文件失败:', error)
    alert('下载文件失败，请稍后重试')
  }
}

// 获取所有合集
const fetchAllSets = async () => {
  if (loadingSets.value) return
  loadingSets.value = true
  try {
    const response = await axios.get('/works-set/list')
    if (response.data.success) {
      allSets.value = response.data.data.sets
      // 获取当前作品所在的合集
      await fetchWorkSets()
    }
  } catch (error) {
    console.error('获取合集列表失败:', error)
  } finally {
    loadingSets.value = false
  }
}

// 获取当前作品所在的合集
const fetchWorkSets = async () => {
  if (!work.value || !work.value.id) return
  
  try {
    // 遍历所有合集，检查作品是否在其中
    const workId = work.value.id
    const setsWithWork = []
    
    for (const set of allSets.value) {
      try {
        const response = await axios.get(`/works-set/${set.id}/works`)
        if (response.data.success) {
          const works = response.data.data.works || []
          if (works.some(w => w.id === workId)) {
            setsWithWork.push(set)
          }
        }
      } catch (error) {
        console.error(`检查合集 ${set.id} 失败:`, error)
      }
    }
    
    workSets.value = setsWithWork
  } catch (error) {
    console.error('获取作品所在合集失败:', error)
  }
}

// 添加作品到合集
const addWorkToSet = async (setId) => {
  if (!canEdit.value) return
  if (!work.value || !work.value.id) return
  
  try {
    await axios.post('/works-set/add-work', {
      setId: setId,
      worksId: work.value.id,
      order: 0
    })
    message.success('添加到合集成功')
    await fetchWorkSets()
    showSetSelector.value = false
  } catch (error) {
    console.error('添加到合集失败:', error)
    if (error.response && error.response.data && error.response.data.message) {
      message.error(error.response.data.message)
    } else {
      message.error('添加到合集失败')
    }
  }
}

// 从合集移出作品
const removeWorkFromSet = async (setId) => {
  if (!canEdit.value) return
  if (!work.value || !work.value.id) return
  
  const confirmed = await confirm('确定要从合集中移出这个作品吗？')
  if (!confirmed) return
  
  try {
    await axios.post('/works-set/remove-work', {
      setId: setId,
      worksId: work.value.id
    })
    message.success('从合集移出成功')
    await fetchWorkSets()
  } catch (error) {
    console.error('从合集移出失败:', error)
    message.error('从合集移出失败')
  }
}

// 打开合集选择器
const openSetSelector = () => {
  if (!canEdit.value) return
  showSetSelector.value = true
}

// 关闭合集选择器
const closeSetSelector = () => {
  showSetSelector.value = false
}

onMounted(async() => {
  await initTagColors() // 初始化标签颜色
  await fetchWorkDetail()
  if (work.value && work.value.id) {
    const itemId = work.value.id
    await fetchComments(itemId)
    await fetchInteractions()
    // 所有用户都可以查看作品所属的合集
    await fetchAllSets()
  }
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
            <div v-if="canEdit" class="interaction-btn" @click="toggleRecommend">
              <i :class="['iconfont', interactions.weight > 0 ? 'icon-xingxingtuijian1' : 'icon--xingxingtuijian']"></i>
              <span v-if="interactions.weight > 0">已推荐</span>
              <span v-else>推荐</span>
            </div>
            <div class="interaction-btn" @click="toggleLike">
              <i :class="['iconfont', hasLiked ? 'icon-dianzan' : 'icon-dianzan-0']"></i>
              <span>{{ interactions.like }}</span>
            </div>
          </div>

        <!-- 合集选择器 -->
        <div v-if="showSetSelector" class="set-selector-overlay" @click="closeSetSelector">
          <div class="set-selector" @click.stop>
            <div class="selector-header">
              <h3>选择合集</h3>
              <button class="close-btn" @click="closeSetSelector">×</button>
            </div>
            <div class="selector-body">
              <div v-if="loadingSets" class="loading">加载中...</div>
              <div v-else-if="allSets.length === 0" class="empty">暂无合集</div>
              <div v-else class="sets-list">
                <div 
                  v-for="set in allSets" 
                  :key="set.id" 
                  class="set-option"
                  :class="{ 'in-set': workSets.some(s => s.id === set.id) }">
                  <span class="set-name">{{ set.name }}</span>
                  <button 
                    v-if="!workSets.some(s => s.id === set.id)"
                    class="add-btn"
                    @click="addWorkToSet(set.id)">
                    添加
                  </button>
                  <span v-else class="in-set-label">已在合集中</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 图片和视频画廊 -->
        <div class="gallery">
          <div class="gallery-main">
            <!-- 显示图片 -->
            <img 
              v-if="currentMedia.type === 'image'" 
              v-image="currentMedia.url" 
              alt="主图">
            <!-- 显示视频 -->
            <video 
              v-else-if="currentMedia.type === 'video'" 
              v-video="currentMedia.url" 
              controls 
              class="gallery-video">
              您的浏览器不支持视频播放
            </video>
            
            <button 
              class="gallery-nav prev" 
              @click="prevMedia"
              v-show="currentImageIndex > 0">
              <i class="iconfont icon-zuojiantou"></i>
            </button>
            <button 
              class="gallery-nav next" 
              @click="nextMedia"
              v-show="currentImageIndex < allMedia.length - 1">
              <i class="iconfont icon-youjiantou"></i>
            </button>
            <!-- 下载按钮 -->
            <button 
              v-if="canEdit" 
              class="download-btn" 
              @click="downloadCurrentMedia"
              title="下载当前文件">
              <i class="iconfont icon-xiazai"></i>
            </button>
          </div>
            
          <div class="gallery-thumbs">
            <!-- 图片缩略图 -->
            <div 
              v-for="(img, index) in work.pictures" 
              :key="`img-${index}`"
              class="thumb"
              :class="{ active: index === currentImageIndex && currentMedia.type === 'image' }"
              @click="selectMedia(index, 'image')">
              <img v-image="img" :alt="`缩略图 ${index + 1}`">
            </div>
            <!-- 视频缩略图 -->
            <div 
              v-if="work.video"
              class="thumb video-thumb"
              :class="{ active: currentMedia.type === 'video' }"
              @click="selectMedia(0, 'video')">
              <div class="video-thumbnail-placeholder">
                <div class="video-play-icon">
                  <i class="iconfont icon-shipin"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
  
        <!-- 作品信息 -->
        <div class="work-info">
          <div class="tags">
            <span 
              v-for="tag in work.tags" 
              :key="tag" 
              class="tag"
              :style="getTagStyle(tag)"
              @click="clickTag(tag)"
              title="点击查看相关作品">
              {{ tag }}
            </span>
          </div>
          
          <div class="description" v-html="work.renderedContent"></div>  

          <!-- 价格信息 -->
          <div v-if="work.price" class="price-info">
            <a 
              v-if="work.link && work.link.trim()" 
              :href="work.link" 
              target="_blank" 
              rel="noopener noreferrer"
              class="shop-link"
              title="点击跳转到购买链接">
              <i class="iconfont icon-shoumai"></i>
              <span class="price-value">¥{{ formatPrice(work.price) }}</span>
              <span>（点击购买）</span>
            </a>
            <div v-else class="price-display">
              <i class="iconfont icon-shoumai"></i>
              <span class="price-value">¥{{ formatPrice(work.price) }}</span>
            </div>
          </div>

          <!-- 材料信息 -->
          <div v-if="materials.length > 0" class="materials-section">
            <h3>材料信息</h3>
            <div class="materials-list">
              <div 
                v-for="material in materials" 
                :key="material.id"
                class="material-item">
                
                <span class="material-name" @click="goToMaterial(material.id)" title="点击查看材料详情">{{ material.name }}</span>
                <span class="material-quantity">×{{ material.quantity }}</span>
                <span v-if="material.substance" class="material-info">{{ material.substance }}</span>
                <span v-if="material.size" class="material-info">{{ material.size }}</span>
                <span v-if="material.color" class="material-info">{{ material.color }}</span>
                <span v-if="material.shape" class="material-info">{{ material.shape }}</span>
              </div>
            </div>
          </div>

          <!-- 合集管理区域（仅登录用户可见） -->
        <div class="sets-section">
          <div class="sets-content">
            <span class="sets-label">所属合集：</span>
            <div v-if="workSets.length > 0" class="work-sets-list">
              <span v-for="set in workSets" :key="set.id" class="set-item">
                <a :href="`/works-set/${set.id}`" class="set-link">{{ set.name }}</a>
                <button v-if="canEdit" class="remove-set-btn" @click="removeWorkFromSet(set.id)" title="移出">×</button>
              </span>
            </div>
            <span v-else class="no-sets">无</span>
            <button v-if="canEdit" class="add-set-btn" @click="openSetSelector">加入</button>
          </div>
        </div>
  
          <div class="update-time">
            最后更新时间: {{ formatDate(work.updatedAt) }}
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

.video-section {
  margin-bottom: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.video-section h3 {
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  color: #333;
}

.video-container {
  display: flex;
  justify-content: center;
}

.work-video {
  max-width: 100%;
  max-height: 500px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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

.download-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 4px;
  background: transparent;
}

.download-btn i {
  font-size: 1.4rem;
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

.thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-thumb {
  position: relative;
}

.video-thumbnail-placeholder {
  width: 100%;
  height: 100%;
  background: #f2f2f2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.video-play-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-play-icon .icon-shipin {
  font-size: 24px;
}


.gallery-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
  
.work-info {
  margin-top: 30px;
}
  
.description {
  color: #333;
  margin: 20px 10px;
  font-size: 0.85rem;
}

:deep(.description p) {
  line-height: 1.5;
  margin-bottom: 8px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 15px 0;
}
  
.tag {
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  height: 20px;
}
  
.update-time {
  color: #999;
  font-size: 12px;
}

.materials-section {
  margin: 15px 0;
  padding: 10px 10px 15px;
  background-color: var(--color-background-soft);
  border-radius: 8px;
}

.materials-section h3 {
  font-size: 0.85rem;
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
  font-size: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.material-name {
  font-weight: bold;
  cursor: pointer;
}

.material-quantity {
  font-weight: bold;
  color: var(--color-blue);
  background-color: var(--color-background-soft);
  padding: 2px 6px 2px 0;
  border-radius: 3px;
  font-size: 0.9em;
}

.material-info {
  font-size: 0.8rem;
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
  gap: 0px;
}

.shop-link {
  color: #499e8d;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: transform 0.2s ease, color 0.2s ease;
  cursor: pointer;
  padding: 0;
}

.shop-link .iconfont {
  font-size: 1.2rem;
}

.shop-link span {
  font-size: 0.75rem;
  color: #999;
}

.shop-link .price-value {
  font-size: 0.8rem;
  color: #333;
  padding-left: 7px;
}

.price-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.price-display i {
  font-size: 1.2rem;
}

.price-display .price-value {
  font-size: 0.8rem;
  color: #333;
}

.price-label {
  color: #666;
  margin-right: 8px;
}
  
.interaction-area {
  display: flex;
  align-items: center;
  gap: 0px;
  font-size: 0.9rem;
}

.interaction-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 5px 10px 5px 0;
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

/* 合集管理样式 */
.sets-section {
  margin: 0px 0 5px;
  padding: 5px 15px 10px 0;
  border-radius: 6px;
}

.sets-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.sets-label {
  font-size: 0.85rem;
  color: #666;
}

.work-sets-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.set-item {
  display: inline-flex;
  align-items: center;
  gap: 0px;
  border-radius: 4px;
}

.set-link {
  color: var(--color-green);
  text-decoration: none;
  font-size: 0.85rem;
}

.set-link:hover {
  text-decoration: underline;
}

.remove-set-btn {
  background: none;
  border: none;
  color: #e53935;
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.remove-set-btn:hover {
  color: #c62828;
}

.no-sets {
  color: #999;
  font-size: 0.85rem;
}

.add-set-btn {
  padding: 2px 7px;
  background-color: #8bb6f7;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  margin-left: auto;
}

.add-set-btn:hover {
  opacity: 0.9;
}

/* 合集选择器样式 */
.set-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.set-selector {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
}

.selector-header h3 {
  margin: 0;
  font-size: 0.9rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.selector-body {
  padding: 0px 20px 15px;
  overflow-y: auto;
  flex: 1;
}

.sets-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.set-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-radius: 4px;
  background: white;
}

.set-option.in-set {
  background: #e7f0ff;
}

.set-name {
  font-size: 0.85rem;
}

.add-btn {
  padding: 4px 12px;
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.add-btn:hover {
  opacity: 0.9;
}

.in-set-label {
  color: #b5b5b5;
  font-size: 0.8rem;
}

.loading, .empty {
  text-align: center;
  padding: 20px;
  color: #999;
}
</style>