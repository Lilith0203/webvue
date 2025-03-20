<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from '../api'

const content = ref('')

// 格式化内容，将换行符转换为<p>标签，将链接格式转换为HTML链接
const formattedContent = computed(() => {
  if (!content.value) return ''
  
  // 将内容分割成段落
  const paragraphs = content.value.split('\n').filter(line => line.trim() !== '');
  
  // 处理每个段落，转换链接格式
  return paragraphs.map(paragraph => {
    // 转换链接格式 [文本](链接)
    const withLinks = paragraph.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    return `<p>${withLinks}</p>`;
  }).join('');
})

// 获取关于页面内容
const fetchContent = async () => {
  try {
    const response = await axios.get('/about')
    content.value = response.data.data.content || defaultContent()
  } catch (error) {
    console.error('获取关于页面内容失败:', error)
    content.value = defaultContent()
  }
}

// 默认内容
const defaultContent = () => {
  return ``
}

// 组件挂载时获取内容
onMounted(fetchContent)
</script>

<template>
  <div class="about">
    <h1 class="about-title">
      <i class="iconfont icon-huawen2"></i>
      <span>关于</span>
      <i class="iconfont icon-huawen1"></i>
    </h1>
    <div class="about-content">
      <div class="about-text">
        <div v-html="formattedContent"></div>
      </div>
      
    </div>
  </div>
</template>

<style>
.about {
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  padding: 0 20px;
  max-width: 800px;
  margin: 10px auto 30px;
}

.about h1 {
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
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

.about p {
  line-height: 2;
  color: var(--color-text);
  width: 100%;
  text-align: center;
}

.about-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.9rem;
}

.about p a {
  color: #499e8d;
  text-decoration: none;
  transition: color 0.3s;
}

.about p a:hover {
  color: hsla(160, 100%, 37%, 1);
}

@media (min-width: 1024px) {
  
  .about h1 {
    font-size: 1.1rem;
  }
  
  .about p {
    font-size: 1rem;
  }
}
</style>
