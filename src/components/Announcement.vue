<!-- src/components/Announcement.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../api'

const props = defineProps({
  configKey: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  showTitle: {
    type: Boolean,
    default: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const content = ref('')
const loading = ref(false)

// 格式化内容，将换行符转换为<p>标签，将链接格式转换为HTML链接
const formattedContent = computed(() => {
  if (!content.value) return '';
  
  // 将内容分割成段落
  const paragraphs = content.value.split('\n').filter(line => line.trim() !== '');
  
  // 处理每个段落，转换链接和颜色格式
  return paragraphs.map(paragraph => {
    // 首先转换颜色标记 [color:red|文本内容]
    let withColors = paragraph.replace(/\[color:([a-z#0-9]+)\|(.*?)\]/g, '<span style="color:$1">$2</span>');
    
    // 然后转换链接格式 [文本](链接)
    const withLinks = withColors.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    return `<p>${withLinks}</p>`;
  }).join('');
})

// 获取公告内容
const fetchContent = async () => {
  loading.value = true
  try {
    const key = `announcement_${props.configKey}`
    const response = await axios.get('/config/load', {
      params: { keys: key }
    })
    
    if (response.data && response.data.success && response.data.data) {
      content.value = response.data.data[key] || ''
    }
  } catch (error) {
    console.error(`获取${props.title}公告失败:`, error)
    content.value = ''
  } finally {
    loading.value = false
  }
}

onMounted(fetchContent)
</script>

<template>
  <div v-if="content" class="about">
    <h1 v-if="showTitle">
      <i class="iconfont icon-huawen2"></i>
      <span>{{ title }}</span>
      <i class="iconfont icon-huawen1"></i>
    </h1>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="content" class="about-content" v-html="formattedContent"></div>
  </div>
</template>

<style scoped>
.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}

.about {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  text-align: left;
  max-width: 800px;
  margin: 10px auto 0px;
}

.about h1 {
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
  padding: 0 36px;
  border-bottom: 1px solid #949494;
}

.about span {
  color: var(--color-text);
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0 10px;
}

.icon-huawen1, .icon-huawen2 {
  font-size: 1.5rem;
}

.about-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.9rem;
}

:deep(.about-content p) {
}

.about p a {
  color: #499e8d;
  text-decoration: none;
  transition: color 0.3s;
}

.about p a:hover {
  color: hsla(160, 100%, 37%, 1);
}
</style>