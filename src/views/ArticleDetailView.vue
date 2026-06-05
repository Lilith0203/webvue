<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../api'
import { marked } from 'marked'
import { useAuthStore } from '../stores/auth'
import { refreshImageUrl } from '../utils/image'
import {
  applyManagedColorMarkup,
  escapeMarkdownSingleAsterisks,
  preserveLeadingSpacesInMarkdown,
  filterTextColors,
  parseArticleImageAlt,
  articleImageStyleAttr
} from '../utils/richText'
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
const textColors = ref([])
const originalImageUrls = ref([])
let imageRenderIndex = 0

const isAdmin = computed(
  () => authStore.isAuthenticated && authStore.user?.role === 'admin'
)

const fetchTextColors = async () => {
  try {
    const response = await axios.get('/colors')
    textColors.value = filterTextColors(response.data?.data)
  } catch (err) {
    console.error('获取文本颜色失败:', err)
  }
}

const fetchComments = async (itemId) => {
  loadingComments.value = true
  errorComments.value = null

  try {
    const response = await axios.get(`/comments/${itemId}`, {
      params: {
        type: 1
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
    link.title ? `title="${link.title}"` : ''
  ].filter(Boolean).join(' ')
  
  return `<a ${attrs}>${link.text}</a>`
}

renderer.image = ({ href, title, text }) => {
  const idx = imageRenderIndex++
  const originalUrl = originalImageUrls.value[idx] || href
  const { alt, maxWidth } = parseArticleImageAlt(text || title || '')
  const safeAlt = alt.replace(/"/g, '&quot;')
  const imgHtml = `<img src="${href}" alt="${safeAlt}"${articleImageStyleAttr(maxWidth)} />`

  if (!isAdmin.value) {
    return imgHtml
  }

  return `<span class="article-image-wrap">${imgHtml}<button type="button" class="article-image-download" data-url="${encodeURIComponent(originalUrl)}" title="下载图片"><i class="iconfont icon-xiazai"></i></button></span>`
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
      const escapedContent = preserveLeadingSpacesInMarkdown(
        escapeMarkdownSingleAsterisks(processedContent)
      )
      imageRenderIndex = 0
      let html = marked.parse(escapedContent, { renderer })
      html = applyManagedColorMarkup(html, textColors.value)
      article.value.renderedContent = html
    }
  } catch (err) {
    error.value = "获取文章失败：" + err.message
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}

// 处理文章内容中的图片链接
const processContent = async (content) => {
  if (!content) return ''

  originalImageUrls.value = []

  // 使用正则表达式匹配Markdown图片语法
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const matches = content.matchAll(imageRegex)
  
  let processedContent = content
  for (const match of matches) {
    const [fullMatch, alt, url] = match
    originalImageUrls.value.push(url)
    const signedUrl = await refreshImageUrl(url)
    processedContent = processedContent.replace(fullMatch, `![${alt}](${signedUrl})`)
  }

  return processedContent
}

const downloadArticleImage = async (originalUrl) => {
  if (!originalUrl) return

  try {
    const signedUrl = await refreshImageUrl(originalUrl)
    const fileName = `${article.value?.title || 'article'}_${Date.now()}.jpg`
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    if (isMobile) {
      location.href = signedUrl
    } else {
      const link = document.createElement('a')
      link.href = signedUrl
      link.download = fileName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  } catch (err) {
    console.error('下载图片失败:', err)
    message.error('下载图片失败，请稍后重试')
  }
}

const handleArticleContentClick = (event) => {
  const downloadBtn = event.target.closest('.article-image-download')
  if (!downloadBtn || !isAdmin.value) return

  event.preventDefault()
  event.stopPropagation()

  const encodedUrl = downloadBtn.dataset.url
  if (!encodedUrl) return

  downloadArticleImage(decodeURIComponent(encodedUrl))
}

// 返回文章列表，保留页码和标签筛选
const goBack = () => {
  const query = {}
  if (route.query.page) query.page = route.query.page
  if (route.query.tag) query.tag = route.query.tag
  router.push({ path: '/article', query })
}

// 提交评论（返回接口 data 供 CommentSection 提示「已发布 / 待展示」）
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
    }
    return response.data
  } catch (error) {
    console.error('提交评论失败:', error)
    return { success: false, message: '提交评论失败：' + (error?.message || '网络错误') }
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
  await fetchTextColors()
  await fetchArticle()
  const itemId = article.value.id/* 获取当前文章或作品的 ID */
  await fetchComments(itemId)
})
</script>

<template>
  <div class="article-detail">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <article v-else-if="article" class="a-complete">
      <div class="articles-header">
        <span class="back-link" @click="goBack">← 返回列表</span>
      </div>
      <h1 class="a-title">{{ article.title }}
        <a href="#" 
           v-if="authStore.isAuthenticated && authStore.user?.role === 'admin'"
           @click.prevent="router.push(`/article/${article.id}/edit`)">
          <i class="iconfont icon-edit"></i>
        </a>
      </h1>
      <div class="meta">
        <span class="date">最后更新时间: {{ article.updatedAt }}</span>
        <p v-if="article.tags" class="tags">Tags：
          <a v-for="tag in article.tags" href="#" @click.prevent="router.push(`/article?tag=${tag}`)">{{ tag }}</a>
        </p>
      </div>
      <div
        class="article-content"
        v-html="article.renderedContent"
        @click="handleArticleContentClick"
      ></div>
    
      <!-- 使用评论组件 -->
      <CommentSection 
        :comments="comments"
        :comment-type="1"
        :comment-item-id="article?.id"
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
  font-size: 1.2rem;
  line-height: 2.5;
  font-weight: bold;
}

.articles-header {
  margin-top: 8px;
  font-size: 0.85rem;
}

.back-link {
  color: #499e8d;
  cursor: pointer;
}

.back-link:hover {
  color: #fd964c;
}

.meta {
  color: #3E3E3E;
  font-size: 0.8rem;
  line-height: 1.8;
}

.article-content {
  margin-top: 20px;
  font-size: 0.9rem;
}

.date {
  font-size: 0.8rem;
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

.icon-edit {
  font-size: 1.2rem;
}

.icon-edit:hover {
  border: 1px dashed #9da09e;
}

:deep(.article-content p) {
  line-height: 1.8em;
  margin-bottom: 6px;
  text-align: left;
  white-space: pre-wrap;
}

:deep(.article-content ul), 
:deep(.article-content ol) {
  line-height: 1.8;
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
  font-size: 0.95rem;
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
  border: 3px solid #fff;
  box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.2);
  max-width: 100%;
}

:deep(.article-content .article-image-wrap) {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: fit-content;
  max-width: 94%;
  margin: 8px auto;
}

:deep(.article-content .article-image-wrap img) {
  display: block;
  max-width: 100%;
  height: auto;
}

:deep(.article-content .article-image-download) {
  position: absolute;
  top: 10px;
  right: 10px;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.05);
}

:deep(.article-content .article-image-download i) {
  font-size: 1.2rem;
}

:deep(.article-content blockquote) {
  font-style: italic;
  font-size: 0.85rem;
  text-align: left;
  color: #3E3E3E;
}

@media (min-width: 1024px) {
  .article-detail {
    margin: 50px auto 120px;
  }

  :deep(.article-content .article-image-wrap) {
    max-width: 86%;
  }
}
</style>