<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { refreshImageUrl } from '../utils/image'

const authStore = useAuthStore()

const imageLoaded = ref(false)
const touchStartX = ref(0)
const touchEndX = ref(0)
const minSwipeDistance = 50 // 最小滑动距离，防止误触

const props = defineProps({
  visible: Boolean,
  imageUrl: String,
  title: String,
  total: {
    type: Number,
    default: 1
  },
  current: {
    type: Number,
    default: 1
  },
  showDetailButton: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'prev', 'next', 'detail'])

// 检查是否有detail事件监听器
const hasDetailListener = computed(() => {
  // 在Vue 3中，我们可以通过检查emit函数是否包含'detail'来判断
  return emit.includes('detail')
})

// 检查是否有编辑权限（登录状态）
const canEdit = computed(() => {
  return authStore.isAuthenticated
})

// 下载当前图片
const downloadCurrentImage = async () => {
  if (!props.imageUrl) return
  
  try {
    // 获取带签名的图片URL
    const signedUrl = await refreshImageUrl(props.imageUrl)
    
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    if (isMobile) {
      // 移动端：直接跳转到图片URL
      location.href = signedUrl
    } else {
      // 桌面端：使用下载链接方式
      const link = document.createElement('a')
      link.href = signedUrl
      link.download = `${props.title || 'image'}_${props.current}.jpg`
      link.target = '_blank'
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  } catch (error) {
    console.error('下载图片失败:', error)
    alert('下载图片失败，请稍后重试')
  }
}

// 键盘事件处理
const handleKeyDown = (e) => {
  if (!props.visible) return
 
  switch(e.key) {
    case 'Escape':
      emit('close')
      break
    case 'ArrowLeft':
      if (props.total > 1) emit('prev')
      break
    case 'ArrowRight':
      if (props.total > 1) emit('next')
      break
  }
}

const handleImageLoad = () => {
  imageLoaded.value = true
}

// 触摸开始时记录起始位置
const handleTouchStart = (e) => {
  touchStartX.value = e.touches[0].clientX
}

// 触摸结束时计算滑动距离并触发相应事件
const handleTouchEnd = (e) => {
  touchEndX.value = e.changedTouches[0].clientX
  const swipeDistance = touchEndX.value - touchStartX.value
  
  // 只在有多张图片时处理滑动
  if (props.total > 1) {
    if (Math.abs(swipeDistance) >= minSwipeDistance) {
      if (swipeDistance > 0) {
        // 向右滑动，显示上一张
        emit('prev')
      } else {
        // 向左滑动，显示下一张
        emit('next')
      }
    }
  }
}

// 监听键盘事件
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="image-preview-overlay" @click="$emit('close')">
      <div class="image-preview-content" @click.stop>
        <!-- 关闭按钮 -->
        <div class="close-btn" @click="$emit('close')">×</div>
        <!-- 下载按钮 -->
        <div 
          v-if="canEdit" 
          class="download-btn" 
          @click="downloadCurrentImage"
          title="下载图片">
          <i class="iconfont icon-xiazai"></i>
        </div>
        <!-- 标题 -->
        <div class="preview-header">
          <h3>{{ title }}</h3>
          <!-- 只在有多张图片时显示计数器 -->
          <span v-if="total > 1" class="image-counter">{{ current }}/{{ total }}</span>
        </div>
        <!-- 图片容器 -->
        <div 
          class="image-container"
          @touchstart="handleTouchStart"
          @touchend="handleTouchEnd"
        >
          <!-- 只在有多张图片时显示上一张按钮 -->
          <div 
            v-if="total > 1" 
            class="nav-btn prev-btn" 
            @click="$emit('prev')">
            ‹
          </div>

          <div class="image-wrapper">
            <img v-image="imageUrl" :alt="title" @load="handleImageLoad">
          </div>
       
          <!-- 只在有多张图片时显示下一张按钮 -->
          <div 
            v-if="total > 1" 
            class="nav-btn next-btn" 
            @click="$emit('next')">
            ›
          </div>
        </div>
        <!-- 底部操作栏 -->
        <div class="preview-footer" @click="$emit('detail')">
          <!-- 只在showDetailButton为true时显示详情按钮 -->
          <span 
            v-if="showDetailButton"
            class="detail-btn">
            查看详情
          </span>
        </div>
      </div>
    </div>
  </Transition>
</template>
  
<style scoped>
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
  
.image-preview-content {
  position: relative;
  background: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  max-width: 90vw;
  max-height: 90vh;
}
  
.image-preview-content img {
  max-width: 100%;
  max-height: calc(90vh - 60px);
  object-fit: contain;
}
  
.preview-header {
  width: calc(100% - 10px);
  position: absolute;
  top: -30px;
  color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
  
.preview-header h3 {
  margin: 0;
  font-size: 1rem;
}

.image-counter {
  font-size: 14px;
  opacity: 0.8;
}

.image-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  touch-action: pan-y pinch-zoom; /* 优化触摸体验 */
  user-select: none; /* 防止图片被选中 */
}

.image-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.1);  /* 加载时的背景色 */
  border-radius: 4px;
}
  
.close-btn {
  position: absolute;
  top: -32px;
  right: -10px;
  border: none;
  color: white;
  font-size: 30px;
  cursor: pointer;
  padding: 0px 10px;
  z-index: 1000;
}

.download-btn {
  position: absolute;
  top: 0;
  left: 10px;
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 4px;
  z-index: 1000;
}

.download-btn i {
  font-size: 1.4rem;
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: #fff;
  font-size: 40px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.prev-btn {
  left: -18px;
}

.next-btn {
  right: -18px;
}

.preview-footer {
  width: calc(100%);
  position: absolute;
  bottom: 0px;
  left: 0px;
  display: flex;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  cursor: pointer;
}

.detail-btn {
  line-height: 1.8rem;
  color: white;
  transition: all 0.3s ease;
}
  
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}
  
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (min-width: 1024px) {

  .prev-btn {
    left: -40px;
  }

  .next-btn {
    right: -40px;
  }
}

@media (max-width: 768px) {
  .download-btn {
    padding: 8px;
    min-width: 44px;
    min-height: 44px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 8px;
  }
  
  .download-btn i {
    font-size: 1.4rem;
  }
}
</style>