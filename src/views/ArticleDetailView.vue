<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import axios from '../api'
import { marked } from 'marked'
import { useAuthStore } from '../stores/auth'
import { refreshImageUrl} from '../utils/image'

const authStore = useAuthStore()

const route = useRoute()
const article = ref(null)
const loading = ref(false)
const error = ref(null)
// 修改 marked 渲染器配置
const renderer = new marked.Renderer()

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

const fetchArticle = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await axios.get(`/article/${route.params.id}`)
    article.value = response.data.article
    if (article.value.content) {
        // 处理文章内容中的所有图片链接
      const processedContent = await processContent(article.value.content)
      article.value.renderedContent = await marked(processedContent)
    }
  } catch (err) {
    error.value = "获取文章失败：" + err.message
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}

// 使用自定义渲染器
marked.use({ renderer })

// 处理文章内容中的图片链接
const processContent = async (content) => {
  if (!content) return ''

  // 使用正则表达式匹配Markdown图片语法
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const matches = content.matchAll(imageRegex)
  
  let processedContent = content
  for (const match of matches) {
    const [fullMatch, alt, url] = match
    const signedUrl = await refreshImageUrl(url)
    processedContent = processedContent.replace(fullMatch, `![${alt}](${signedUrl})`)
  }

  return processedContent
}

onMounted(() => {
  fetchArticle()
})
</script>

<template>
  <div class="article-detail">
    <a :href="/article/" class="a-back">&lt;&lt;返回列表</a>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <article v-else-if="article" class="a-complete">
      <h1 class="a-title">{{ article.title }}</h1>
      <p v-if="authStore.isAuthenticated"><a :href="`/article/${article.id}/edit`">编辑</a></p>
      <div class="meta">
        <span class="date">最后更新时间: {{ article.updatedAt }}</span>
        <p v-if="article.tags" class="tags">Tags：
            <a v-for="tag in article.tags">{{ tag }}</a>
        </p>
      </div>
      <div class="article-content" v-html="article.renderedContent"></div>
    </article>
  </div>
</template>

<style scoped>
.article-detail {
    margin: 20px auto 20px;
}

.a-title {
    font-size: 24px;
    line-height: 3;
    font-weight: bold;
}

.meta {
    color: #3E3E3E;
    font-size: 14px;
    line-height: 1.8;
}

.article-content {
    margin-top: 20px;
    font-size: 14px;
}

:deep(.article-content p) {
  text-indent: 2em;
  line-height: 1.8em;
  margin-bottom: 6px;
  text-align: left;
}

:deep(.article-content ul), 
:deep(.article-content ol) {
  font-size: 14px;
  line-height: 1.6em;
  margin-bottom: 6px;
  text-align: left;
}

:deep(.article-content h1) {
  line-height: 2;
  margin-top: 10px;
  font-weight: bold;
  text-align: left;
}

:deep(.article-content h3) {
  line-height: 2;
  margin-top: 10px;
  font-weight: bold;
  text-align: left;
}

:deep(.article-content a) {
  color: #4a9dd9;
  border-bottom: 1px dashed #C9DFFB;
}

:deep(.article-content .demo) {
  display: inline-block;
  width: 60px;
  background-color: #4a9dd9;
  color: #fff;
  font-weight: bold;
  text-align: center;
  line-height: 1.8;
  border: 1px dashed #fff;
}

:deep(.article-content .demo:hover) {
  background-color: #C9DFFB;
}

:deep(.article-content code) {
  display: block;
  white-space: pre-wrap;
  text-align: left;
  margin: 10px 35px;
  font-size: 13px;
  font-family: inherit;
}

:deep(.article-content img) {
  max-width: 100%;
  border: 3px solid #fff;
  box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.2);
  margin: 8px 0;
}

:deep(.article-content blockquote) {
  font-style: italic;
  font-size: 13px;
  text-align: left;
  color: #3E3E3E;
}

@media (min-width: 1024px) {
    .article-detail {
        margin: 100px auto 120px;
    }
}
</style>