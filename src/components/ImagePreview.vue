<script setup>
import { ref, onMounted, onUnmounted,computed } from 'vue'

const imageLoaded = ref(false)

const props =defineProps({
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
  }
})

const emit = defineEmits(['close', 'prev', 'next', 'detail'])
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
        <!-- 标题 -->
        <div class="preview-header">
          <h3>{{ title }}</h3>
          <!-- 只在有多张图片时显示计数器 -->
          <span v-if="total > 1" class="image-counter">{{ current }}/{{ total }}</span>
        </div>
        <!-- 图片容器 -->
        <div class="image-container">
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
          <!-- 只在 WorkGallery 中显示详情按钮 -->
          <span 
            v-if="total > 1"
            class="detail-btn" >
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
  padding: 3px;
  border-radius: 8px;
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
  top: -30px;
  right: 0px;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0px 10px;
  z-index: 1000;
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
  left: -22px;
}

.next-btn {
  right: -22px;
}

.preview-footer {
  width: calc(100% - 10px);
  position: absolute;
  bottom: 5px;
  left: 5px;
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
  .image-preview-content img {
    max-width: 600px;
  }

  .prev-btn {
    left: -40px;
  }

  .next-btn {
    right: -40px;
  }
}
</style>