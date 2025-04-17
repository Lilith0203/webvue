<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  videos: {
    type: Array,
    default: () => []
  },
  visible: {
    type: Boolean,
    default: false
  },
  videoUrl: {
    type: String,
    default: ''
  }
})

const currentVideoIndex = ref(0)
const currentVideo = ref(null)
const emit = defineEmits(['close'])

// 解析B站链接获取BV号或av号
const parseVideoId = (url) => {
  // 匹配BV号
  const bvMatch = url.match(/BV\w+/)
  if (bvMatch) return bvMatch[0]
  
  // 匹配av号
  const avMatch = url.match(/av(\d+)/)
  if (avMatch) return `aid=${avMatch[1]}`
  
  return null
}

// 获取嵌入式播放器链接
const getEmbedUrl = (url) => {
  if (!url) return ''
  
  // 匹配BV号
  const bvMatch = url.match(/BV\w+/)
  if (bvMatch) {
    return `//player.bilibili.com/player.html?bvid=${bvMatch[0]}&page=1&high_quality=1&danmaku=0`
  }
  
  // 匹配av号
  const avMatch = url.match(/av(\d+)/)
  if (avMatch) {
    return `//player.bilibili.com/player.html?aid=${avMatch[1]}&page=1&high_quality=1&danmaku=0`
  }
  
  // 如果是完整的B站视频页面链接
  const urlObj = new URL(url)
  if (urlObj.hostname.includes('bilibili.com')) {
    const bvid = urlObj.pathname.match(/BV\w+/)
    if (bvid) {
      return `//player.bilibili.com/player.html?bvid=${bvid[0]}&page=1&high_quality=1&danmaku=0`
    }
  }
  
  return url
}

// 播放下一个视频
const playNext = () => {
  if (currentVideoIndex.value < props.videos.length - 1) {
    currentVideoIndex.value++
  }
}

// 播放上一个视频
const playPrev = () => {
  if (currentVideoIndex.value > 0) {
    currentVideoIndex.value--
  }
}

// 监听视频列表变化
watch(() => props.videos, () => {
  if (props.videos.length > 0) {
    currentVideo.value = getEmbedUrl(props.videos[currentVideoIndex.value])
  }
}, { immediate: true })

// 监听当前视频索引变化
watch(currentVideoIndex, () => {
  if (props.videos.length > 0) {
    currentVideo.value = getEmbedUrl(props.videos[currentVideoIndex.value])
  }
})

const handleClose = () => {
  emit('close')
}

// 处理键盘事件
const handleKeyDown = (e) => {
  if (e.key === 'Escape') {
    handleClose()
  }
}

// 监听键盘事件
watch(() => props.visible, (newVal) => {
  if (newVal) {
    window.addEventListener('keydown', handleKeyDown)
  } else {
    window.removeEventListener('keydown', handleKeyDown)
  }
})
</script>

<template>
  <div class="video-player">
    <div class="player-container" v-if="currentVideo">
      <iframe 
        :src="currentVideo" 
        scrolling="no" 
        border="0" 
        frameborder="no" 
        framespacing="0" 
        allowfullscreen="true"
      ></iframe>
    </div>
    
    <div class="controls">
      <button 
        class="control-btn" 
        @click="playPrev" 
        :disabled="currentVideoIndex === 0"
      >
        上一个
      </button>
      <span class="video-counter">{{ currentVideoIndex + 1 }} / {{ videos.length }}</span>
      <button 
        class="control-btn" 
        @click="playNext" 
        :disabled="currentVideoIndex === videos.length - 1"
      >
        下一个
      </button>
    </div>
    
    <!-- 视频列表 -->
    <div class="video-list">
      <div 
        v-for="(video, index) in videos" 
        :key="index"
        class="video-item"
        :class="{ active: index === currentVideoIndex }"
        @click="currentVideoIndex = index"
      >
        视频 {{ index + 1 }}
      </div>
    </div>
  </div>

  <div v-if="visible" class="video-player-modal" @click.self="handleClose">
    <div class="video-player-container">
      <div class="video-header">
        <button class="close-btn" @click="handleClose">×</button>
      </div>
      <div class="video-content">
        <iframe 
          :src="getEmbedUrl(videoUrl)"
          frameborder="0" 
          scrolling="no" 
          border="0" 
          framespacing="0" 
          allowfullscreen="true"
        ></iframe>
      </div>
      <div class="video-footer">
        <a :href="videoUrl" target="_blank" class="original-link">
          <i class="iconfont icon-bilibili1"></i>
          在B站观看
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-player {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.player-container {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 宽高比 */
}

.player-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin: 20px 0;
}

.control-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #499e8d;
  color: white;
  cursor: pointer;
}

.control-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.video-counter {
  font-size: 14px;
  color: #666;
}

.video-list {
  margin-top: 20px;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}

.video-item {
  padding: 10px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.video-item:hover {
  background-color: #f5f5f5;
}

.video-item.active {
  background-color: #e6f2ff;
  color: #499e8d;
}

.video-player-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.video-player-container {
  width: 90%;
  max-width: 1000px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.video-header {
  padding: 10px;
  display: flex;
  justify-content: flex-end;
  background: #f5f5f5;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0 10px;
}

.video-content {
  position: relative;
  width: 100%;
  padding-top: 56.25%; /* 16:9 宽高比 */
}

.video-content iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video-footer {
  padding: 15px;
  text-align: center;
  border-top: 1px solid #eee;
}

.original-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #00a1d6;
  text-decoration: none;
  font-size: 14px;
}

.original-link:hover {
  color: #00b5e5;
}

.original-link .iconfont {
  font-size: 20px;
}
</style>