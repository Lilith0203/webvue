<!-- components/WorkGallery.vue -->
<template>
    <div class="work-gallery">
      <h3 class="gallery-title">
        <i class="iconfont icon-huawen2"></i>
        <a :href="`/works`">作品展示</a>
        <i class="iconfont icon-huawen1"></i></h3>
      <div class="gallery-grid">
        <div v-for="work in thumbnailWorks" 
             :key="work.id" 
             class="gallery-item"
             @click="showPreview(work)">
          <div class="image-wrapper">
            <img v-image="work.thumbnailUrl" :alt="work.name">
            <div class="item-overlay">
              <span class="item-name">{{ work.name }}</span>
            </div>
          </div>
        </div>
      </div>
  
      <!-- 图片预览组件 -->
      <ImagePreview
        v-if="previewVisible"
        :visible="previewVisible"
        :image-url="previewImage"
        :title="previewTitle"
        @close="closePreview"
      />
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, computed } from 'vue'
  import axios from '../api'
  import ImagePreview from './ImagePreview.vue'
  
  const works = ref([])
  const loading = ref(false)
  const error = ref(null)
  
  // 预览状态
  const previewVisible = ref(false)
  const previewImage = ref('')
  const previewTitle = ref('')
  
  // 获取作品数据
  const fetchWorks = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await axios.get('/works?size=12')
      works.value = response.data.works
    } catch (err) {
      error.value = "获取作品失败：" + err.message
      console.error('Fetch error:', err)
    } finally {
      loading.value = false
    }
  }
  
  // 显示预览
  const showPreview = (work) => {
    previewImage.value = work.pictures[0]
    previewTitle.value = work.name
    previewVisible.value = true
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
  return `${url}?x-oss-process=image/resize,w_240`
}

// 使用computed属性处理works数据
const thumbnailWorks = computed(() => {
  return works.value.map(work => ({
    ...work,
    thumbnailUrl: getThumbnailUrl(work.pictures[0]),  // 添加缩略图URL
    originalUrl: work.pictures[0]  // 保存原图URL
  }))
})
  
  // 组件挂载时获取数据
  onMounted(fetchWorks)
  </script>
  
<style scoped>
.work-gallery {
  margin: 1rem 0 1rem 0;
}
  
  .gallery-title {
    font-size: 1.1rem;
    color: var(--color-heading);
    margin-bottom: 10px;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }

  .gallery-title a {
    color: var(--color-font);
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
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
  
  /* 响应式调整 */
  @media (max-width: 768px) {
    .gallery-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
    }
  
    .gallery-title {
      font-size: 1rem;
      margin-bottom: 0px;
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