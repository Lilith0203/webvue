<script setup>
import axios from '../api'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { marked } from 'marked'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const guide = ref(null)
const loading = ref(false)
const error = ref(null)

const fetchGuide = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await axios.get(`/guide/${route.params.id}`)
    guide.value = response.data.data
    if (guide.value.content) {
      guide.value.renderedContent = marked(guide.value.content)
    }
  } catch (err) {
    error.value = "获取攻略失败：" + err.message
  } finally {
    loading.value = false
  }
}

// 返回攻略列表页，保持搜索条件和页码状态
const goBack = () => {
  // 从当前URL获取查询参数
  const currentQuery = route.query
  // 构建返回URL，保持所有查询参数
  const backUrl = {
    path: '/guide',
    query: currentQuery
  }
  router.push(backUrl)
}

onMounted(() => {
  fetchGuide()
})
</script>

<template>
  <div class="guide-detail">
    <a href="/guide" @click.prevent="goBack" class="g-back"><i class="iconfont icon-back"></i></a>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <article v-else-if="guide" class="g-complete">
      <h1 class="g-title">{{ guide.title }}
        <a href="#" 
           v-if="authStore.isAuthenticated"
           @click.prevent="router.push(`/guide/${guide.id}/edit`)">
          <i class="iconfont icon-bianji"></i>
        </a>
      </h1>
      <div class="meta">
        <span class="date">最后更新时间: {{ guide.updatedAt }}</span>
        <p v-if="guide.category" class="tags">分类：
          <span class="category-tag">{{ guide.category }}</span>
        </p>
        <p v-if="guide.tags" class="tags">标签：
          <a v-for="tag in guide.tags.split(',')" :key="tag" href="#" @click.prevent="router.push(`/guide?tag=${tag.trim()}`)">{{ tag.trim() }}</a>
        </p>
      </div>
      <div class="guide-content" v-html="guide.renderedContent"></div>
    </article>
  </div>
</template>

<style scoped>
.guide-detail {
  margin: 0px auto 0;
}

.g-title {
  font-size: 22px;
  line-height: 1.8;
  font-weight: bold;
}

.meta {
  color: #3E3E3E;
  font-size: 14px;
  line-height: 1.8;
}

.guide-content {
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

.category-tag {
  color: #499e8d;
  padding: 0px 0 1px 0;
  font-size: 0.8rem;
  border-bottom: 1px dashed #499e8d;
}

.icon-bianji {
  font-size: 1.2rem;
}

.icon-bianji:hover {
  border: 1px dashed #9da09e;
}

:deep(.guide-content p) {
  text-indent: 2em;
  line-height: 1.8em;
  margin-bottom: 6px;
  text-align: left;
}

:deep(.guide-content ul), 
:deep(.guide-content ol) {
  font-size: 14px;
  line-height: 1.6em;
  margin-bottom: 6px;
  text-align: left;
}

:deep(.guide-content h1) {
  line-height: 2;
  margin-top: 10px;
  font-weight: bold;
  text-align: left;
}

:deep(.guide-content h3) {
  line-height: 2;
  margin-top: 10px;
  font-weight: bold;
  text-align: left;
}

:deep(.guide-content a) {
  color: #4a9dd9;
  border-bottom: 1px dashed #C9DFFB;
}

:deep(.guide-content strong) {
  font-weight: bold;
}

:deep(.guide-content .demo) {
  display: inline-block;
  width: 60px;
  background-color: #4a9dd9;
  color: #fff;
  font-weight: bold;
  text-align: center;
  line-height: 1.8;
  border: 1px dashed #fff;
}

:deep(.guide-content .demo:hover) {
  background-color: #C9DFFB;
}

:deep(.guide-content code) {
  display: block;
  white-space: pre-wrap;
  text-align: left;
  margin: 10px 35px;
  font-size: 13px;
  font-family: inherit;
  color: #575757;
}

:deep(.guide-content img) {
  display: block;
  max-width: 100%;
  border: 3px solid #fff;
  box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.2);
  margin: 8px auto;
}

:deep(.guide-content blockquote) {
  font-style: italic;
  font-size: 13px;
  text-align: left;
  color: #3E3E3E;
}

:deep(.guide-content table) {
  width: 100%;
  border-collapse: collapse;
  margin: 15px 0;
  font-size: 12px;
  overflow-x: auto;
  min-width: 600px;
}

:deep(.guide-content table th) {
  background-color: #f2f2f2;
  border: 1px solid #ddd;
  padding: 5px;
  text-align: left;
  font-weight: bold;
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
}

:deep(.guide-content table td) {
  border: 1px solid #ddd;
  padding: 5px;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

:deep(.guide-content table tr:nth-child(even)) {
  background-color: #f9f9f9;
}

:deep(.guide-content table tr:hover) {
  background-color: #f5f5f5;
}

:deep(.guide-content) {
  overflow-x: auto;
}

.g-back {
  margin-top: 15px;
}

.icon-back {
    font-size: 20px;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  color: #dc3545;
}

@media (min-width: 1024px) {
  .guide-detail {
    margin: 50px auto 120px;
  }

  .g-back {
    margin-top: 0;
    display: initial;
  }

  .icon-back {
    font-size: 1.5rem;
  }
}
</style> 