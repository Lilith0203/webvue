<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../api'
import { marked } from 'marked'
import { useAuthStore } from '../stores/auth'
import { refreshImageUrl} from '../utils/image'
import CommentSection from '../components/CommentSection.vue'
import { confirm } from '../utils/confirm'
import { message } from '../utils/message'

const authStore = useAuthStore()

const route = useRoute()
const router = useRouter()
const article = ref(null)
const loading = ref(false)
const error = ref(null)
// 修改 marked 渲染器配置
const renderer = new marked.Renderer()

const comments = ref([])  // 存储评论
const loadingComments = ref(false)
const errorComments = ref(null)

const fetchComments = async (itemId) => {
  loadingComments.value = true
  errorComments.value = null

  try {
    const response = await axios.get(`/comments/${itemId}`, {
      params: {
        type: 1,
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
      // 转义星号，防止被Markdown解析为斜体
      const escapedContent = processedContent.replace(/\*/g, '\\*')
      article.value.renderedContent = await marked(escapedContent)
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

// 返回上一个页面
const goBack = () => {
  // 获取进入详情页之前的页码，如果没有则默认为第1页
  const page = route.query.page || 1
  // 返回到文章列表页，并保留页码
  router.push({
    path: '/article',
    query: { page }
  })
}

// 提交评论
const submitComment = async (commentData) => {
  try {
    const response = await axios.post('/comment', {
      name: commentData.name,
      content: commentData.content,
      type: 1,
      itemId: article.value.id,
      reply: commentData.reply || 0 // 如果是回复，传递回复的评论ID
    })
    if (response.data.success) {
      await fetchComments(article.value.id) // 重新获取评论
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
      await fetchComments(article.value.id) // 重新获取评论
    } catch (error) {
      console.error('删除失败:', error)
    }
  }
}

onMounted(async () => {
  await fetchArticle()
  const itemId = article.value.id/* 获取当前文章或作品的 ID */
  await fetchComments(itemId)
})
</script>

<template>
  <div class="article-detail">
    <a href="/article" @click.prevent="goBack" class="a-back"><i class="iconfont icon-back"></i></a>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <article v-else-if="article" class="a-complete">
      <h1 class="a-title">{{ article.title }} 
        <a href="#" 
           v-if="authStore.isAuthenticated"
           @click.prevent="router.push(`/article/${article.id}/edit`)">
          <i class="iconfont icon-bianji"></i>
        </a>
      </h1>
      <div class="meta">
        <span class="date">最后更新时间: {{ article.updatedAt }}</span>
        <p v-if="article.tags" class="tags">Tags：
          <a v-for="tag in article.tags" href="#" @click.prevent="router.push(`/article?tag=${tag}`)">{{ tag }}</a>
        </p>
      </div>
      <div class="article-content" v-html="article.renderedContent"></div>
    
      <!-- 使用评论组件 -->
      <CommentSection 
        :comments="comments" 
        :onCommentSubmit="submitComment"
        :onCommentDelete="deleteComment"/>
    </article>
  </div>
</template>

<style scoped>
.article-detail {
  margin: 0px auto 0;
}

.a-title {
  font-size: 24px;
  line-height: 2.5;
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

.date {
  font-size: 0.7rem;
  color: #9da09e;
}

.tags {
  margin-top: 0.5rem;
}

.tags a {
  padding: 0 0 1px 0;
  margin-right: 0.3rem;
  border-bottom: 1px dashed #499e8d;
}

.tags a:hover {
  opacity: 0.8;
}

.icon-bianji {
  font-size: 1.2rem;
}

.icon-bianji:hover {
  border: 1px dashed #9da09e;
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

:deep(.article-content strong) {
  font-weight: bold;
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
  color: #575757;
}

:deep(.article-content img) {
  display: block;
  max-width: 100%;
  border: 3px solid #fff;
  box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.2);
  margin: 8px auto;
}

:deep(.article-content blockquote) {
  font-style: italic;
  font-size: 13px;
  text-align: left;
  color: #3E3E3E;
}

.a-back {
  display: none;
}

@media (min-width: 1024px) {
  .article-detail {
    margin: 50px auto 120px;
  }

  .a-back {
    display: initial;
  }

  .icon-back {
    font-size: 1.5rem;
  }
}
</style>