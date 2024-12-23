<script setup>
  import { ref, onMounted, computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import axios from '../api'
  import { useAuthStore } from '../stores/auth'
  import WorkEditor from '../components/WorkEditor.vue'
  import { marked } from 'marked'

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
  const isEditing = ref(false)
  const currentImageIndex = ref(0)
  const newTag = ref('')
const editorMode = ref('edit')
const showEditor = ref(false)
const currentWork = ref(null)

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
      work.value.renderedContent = await marked(work.value.description)
      currentImageIndex.value = 0
    } catch (error) {
      console.error('获取作品详情失败:', error)
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
  
  onMounted(() => {
    fetchWorkDetail()
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
          @cancel="closeEditor"
        />
  
        <!-- 作品展示 -->
        <template v-else>
          <!-- 作品标题和操作按钮 -->
          <a @click="router.back()" class="a-back"><i class="iconfont icon-back"></i></a>
        <div class="header">
          <h2>{{ work.name }}</h2>
          <div v-if="canEdit" @click="startEdit(work)"><i class="iconfont icon-bianji"></i></div>
        </div>
          <!-- 图片画廊 -->
          <div class="gallery">
            <div class="gallery-main">
              <img v-image="currentImage" alt="主图">
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
                <img v-image="img" :alt="`缩略图 ${index + 1}`">
              </div>
            </div>
          </div>
  
          <!-- 作品信息 -->
          <div class="work-info">
            <div class="description" v-html="work.renderedContent"></div>
            
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
        </template>
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
    margin-bottom: 20px;
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
    font-size: 1rem;
    font-weight: bold;
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
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
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
    padding: 2px 6px;
    background-color: #f0f0f0;
    border-radius: 4px;
    font-size: 12px;
  }
  
  .update-time {
    color: #999;
    font-size: 12px;
  }
  
  @media (max-width: 768px) {
    .work-detail {
      padding-top: 0;
    }
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