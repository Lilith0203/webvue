<script setup>
import { ref, onMounted, computed, onBeforeMount, onBeforeUnmount } from 'vue'
import axios from '../api'
import ImagePreview from './ImagePreview.vue'
import { useRouter } from 'vue-router'
  
const router = useRouter()
const works = ref([])
const loading = ref(false)
const error = ref(null)
const gridColumns = ref(3) // 默认3列
  
// 预览状态
const previewVisible = ref(false)
const previewImage = ref('')
const previewTitle = ref('')
const currentWork = ref(null)
const currentIndex = ref(0)
  
// 获取推荐作品数据
const fetchRecommendedWorks = async () => {
  loading.value = true
  error.value = null
    
  try {
    // 根据列数动态调整获取的作品数量
    const itemsPerRow = gridColumns.value
    const rows = 3 // 固定3行
    const size = itemsPerRow * rows
      
    const response = await axios.get('/recommended-items', {
      params: {
        type: 2,
        page: 1,
        size: size
      }
    })
    
    if (response.data.success) {
      works.value = response.data.data.items
    }
  } catch (err) {
    error.value = "获取推荐作品失败：" + err.message
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}

// 调整网格列数
const adjustGridColumns = () => {
  const width = window.innerWidth
  if (width >= 1200) {
    gridColumns.value = 4 // 大屏幕显示4列
  } else {
    gridColumns.value = 3 // 小屏幕显示3列
  }
}
  
// 监听窗口大小变化
const handleResize = () => {
  adjustGridColumns()
  fetchRecommendedWorks() // 重新获取适合当前列数的作品
}
  
// 组件挂载前调整列数
onBeforeMount(() => {
  adjustGridColumns()
})
  
// 组件挂载时获取数据并添加窗口大小监听
onMounted(() => {
  fetchRecommendedWorks()
  window.addEventListener('resize', handleResize)
})
  
// 组件卸载前移除监听
onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
  
// 跳转到详情页
const goToDetail = () => {
  if (currentWork.value) {
    router.push(`/works/${currentWork.value.id}`)
  }
}
  
// 显示预览
const showPreview = (work, index) => {
  currentIndex.value = index
  currentWork.value = work
  previewImage.value = work.pictures[0]
  previewTitle.value = work.name
  previewVisible.value = true
}

// 切换图片的方法
const changeImage = (direction) => {
  const works = thumbnailWorks.value
  const len = works.length
  if (len <= 1) return
  if (direction === 'next') {
    currentIndex.value = (currentIndex.value + 1) % len
  } else {
    currentIndex.value = (currentIndex.value - 1 + len) % len
  }
  const nextWork = works[currentIndex.value]
  currentWork.value = nextWork
  previewImage.value = nextWork.pictures[0]
  previewTitle.value = nextWork.name
}
  
// 关闭预览
const closePreview = () => {
  previewVisible.value = false
  previewImage.value = ''
  previewTitle.value = ''
}

// 处理缩略图URL
const getThumbnailUrl = (url) => {
  if (!url) return ''
  // 添加OSS图片处理参数，限制宽度为200px
  return `${url}?x-oss-process=image/resize,w_600`
}

// 使用computed属性处理works数据
const thumbnailWorks = computed(() => {
  return works.value.map(work => ({
    ...work,
    thumbnailUrl: getThumbnailUrl(work.pictures[0]),
    originalUrl: work.pictures[0]
  }))
})

// 判断是否为宽图（4:3）
const isWideImage = (url) => {
  // 如果需要，你可以在这里添加实际的图片比例检测逻辑
  // 现在简单返回 true 用于测试
  return true
}
</script>

<template>
  <div class="work-gallery">
    <div class="gallery-title">
      <h3>
        <i class="iconfont icon-huawen2"></i>
        <a href="/works" @click.prevent="router.push('/works')">作品</a>
        <i class="iconfont icon-huawen1"></i>
      </h3>
    </div>
    <div class="gallery-grid" :style="{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }">
      <div v-for="(work, index) in thumbnailWorks" 
           :key="work.id" 
           class="gallery-item"
           @click="showPreview(work, index)">
        <div class="image-wrapper">
          <img v-image="work.thumbnailUrl" 
          :alt="work.name"
          :class="{ 'contain-image': isWideImage(work.originalUrl) }">
          <div class="item-overlay">
            <span class="item-name">{{ work.name }}</span>
          </div>
        </div>
      </div>
    </div>
    <span class="more">
      <a href="/works" @click.prevent="router.push('/works')">More</a>
    </span>

    <!-- 图片预览组件 -->
    <ImagePreview
      v-if="previewVisible"
      :visible="previewVisible"
      :image-url="previewImage"
      :title="previewTitle"
      :total="thumbnailWorks.length"
      @close="closePreview"
      :current="currentIndex + 1"
      :show-detail-button="true"
      @prev="changeImage('prev')"
      @next="changeImage('next')"
      @detail="goToDetail"
    />
  </div>
</template>
  
<style scoped>
.work-gallery {
  margin: 0.5rem 0 0.4rem 0;
}
  
.gallery-title {
  margin-bottom: 10px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.gallery-title h3 {
  padding: 0 36px;
  border-bottom: 1px solid #949494;
}

.gallery-title a {
  font-size: 1.1rem;
  color: var(--color-text);
  padding: 0 10px;
  font-weight: bold;
}

.gallery-title a:hover {
  color: var(--color-blue);
}

.icon-huawen1, .icon-huawen2 {
  font-size: 1.5rem;
  color: var(--color-text);
}
  
.gallery-grid {
  display: grid;
  gap: 20px;
  padding: 10px;
}
  
.gallery-item {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
  
.gallery-item:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
  
.image-wrapper {
  position: relative;
  padding-bottom: 100%; /* 1:1 宽高比 */
  background-color: #f5f5f5;
}
  
.image-wrapper img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

/* 4:3 图片使用 contain */
.image-wrapper img.contain-image {
  object-fit: contain;
  background-color: #323232;
}
  
.item-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  color: white;
  opacity: 0;
  transition: opacity 0.3s ease;
}
  
.gallery-item:hover .item-overlay {
  opacity: 1;
}
  
.item-name {
  font-size: 0.9rem;
  display: block;
  text-align: center;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
  
/* 加载状态 */
.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}
  
/* 错误状态 */
.error {
  text-align: center;
  padding: 20px;
  color: #dc3545;
}

.gallery-item {
  animation: fadeIn 0.5s ease forwards;
}
  
/* 错开动画延迟 */
.gallery-item:nth-child(2n) {
  animation-delay: 0.1s;
}
  
.gallery-item:nth-child(3n) {
  animation-delay: 0.2s;
}
  
/* 加载动画 */
.loading::after {
  content: '';
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #ddd;
  border-top-color: #42b883;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.more {
  display: block;
  text-align: center;
}

.more a {
  color: #499e8d;
  padding: 0;
}
  
/* 响应式调整 */
@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 10px;
  }
  
  .gallery-title {
    font-size: 1rem;
    margin-bottom: 10px;
  }
  
  .item-name {
    font-size: 0.8rem;
  }
}
  
/* 动画效果 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
  
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>