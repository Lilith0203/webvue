<script setup>
import axios from '../api'
//import axios from 'axios'
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()

const route = useRoute()
const router = useRouter()
const backendData = ref(null)
const loading = ref(false)
const error = ref(null)

const fetchData = async () => {
  loading.value = true
  error.value = null

  try {
    const page = route.query.page || 1
    const size = route.query.size || 8
    const tag = route.query.tag || ''
    const response = await axios.get(`/article?`, {
      params: {
        page,
        size,
        tag
      }
    })
    backendData.value = response.data
  } catch (err) {
    error.value = "获取数据失败：" + err.message
  } finally {
    loading.value = false
  }
}

// 处理删除
const handleDelete = async (id) => {
  if (confirm('确定要取消编辑吗？未保存的修改将丢失')) {
      try {
      await axios.post(`/article/delete`, {id:id})
      router.push('/article')
      await fetchData()
    } catch (error) {
      console.error('删除失败:', error)
    } finally {
    }
  }
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return {
    day: date.getDate().toString().padStart(2, '0'),
    month: date.getMonth() + 1,
    month_en: date.toLocaleString('en', { month: 'short' }),
    year: date.getFullYear()
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <main>
    <div class="content-wrapper">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div class="articles-header">
        <p id="all-info" v-if="backendData">
          <span v-if="route.query.tag">
            当前标签：<span class="current-tag">
              {{route.query.tag}}<a href="/article" class="clear-tag">×</a></span>，</span>
          共 <span>{{backendData.count}}</span> 篇文章
        </p>
        <span v-if="authStore.isAuthenticated" class="publish-new"><a :href="`/publish`">发布+</a></span>
      </div>
      <div class="list-wrapper" v-if="backendData">
        <article class="a-brief" v-for="article in backendData.articles" :key="article.id">
          <time :datetime="article?.createdAt" class="create-time">
            <span class="time-date">{{ formatDate(article.createdAt).month }}.{{ formatDate(article.createdAt).day }}</span><br/>
            <span>{{ formatDate(article.createdAt).month_en }}.</span><br/>
            <span>{{ formatDate(article.createdAt).year }}</span>
          </time>
          <div class="a-content">
            <div class="operation">
              <div v-if="article.tags" class="a-label">Tag: 
                <a v-for="tag in article.tags"
                :key="tag"
                :href="`article?tag=${tag}`">{{tag}}</a>
              </div>
              <span v-if="authStore.isAuthenticated" class="edit-delete">
                <a class="edit" :href="`/article/${article.id}/edit`"><i class="iconfont icon-bianji"></i></a>
                <a class="delete" href="#" @click.prevent="handleDelete(article.id)"><i class="iconfont icon-shanchu"></i></a>
              </span>
            </div>
            <h1 class="a-title"><a :href="`/article/${article.id}`">{{article.title}}</a></h1>
            <div class="a-brief-text">
              <p>{{article.abbr}}
                <a :href="`/article/${article.id}`" class="read-detail">（阅读全文）</a>
              </p>
            </div>
            <time class="update-time" :datetime="article?.updatedAt">最后更新时间：<span>{{ article.updatedAt }}</span></time>
          </div>
        </article>

        <div class="pages">
          <span>当前页：<span class="cur">{{backendData.page_now}}</span>/{{backendData.page_all}}页</span>
          <a v-if="backendData.page_now !== 1" 
          :href="`/article?page=${backendData.page_now-1}${route.query.tag ? '&tag=' + route.query.tag : ''}`" class='able'>上一页</a>
          <a v-if="backendData.page_now !== backendData.page_all" 
          :href="`/article?page=${backendData.page_now+1}${route.query.tag ? '&tag=' + route.query.tag : ''}`" class='able'>下一页</a>
          <a :href="`/article?page=${backendData.page_all}${route.query.tag ? '&tag=' + route.query.tag : ''}`" class='able'>尾页</a>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.articles-header {
  font-size: 0.9rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
}

.content-wrapper {
    margin: 20px auto 20px;
}

.a-brief {
  display: flex;
  margin-bottom: 25px;
  border-bottom: 1px dashed #e4e4e4;
  padding-bottom: 0.5rem;
}

.a-title {
  font-size: 18px;
  line-height: 45px;
}

.create-time {
  flex: 0 0 60px;
  height: 86px;
  padding-top: 15px;
  margin-right: 20px;
  background: url(/images/article-time.png) no-repeat;
  color: #d6d6d6;
  text-align: center;
  font-size: 12px;
  line-height: initial;
}

.create-time span {
  font-weight: bold;
}

.time-date {
  font-size: 18px;
}

.a-content {
  flex: 1;
}

.a-label {
  font-size: 14px;
  line-height: 1.8em;
}

.a-label a {
    font-size: 0.8rem;
    transition: all 0.3s ease;
    padding: 0px 0px 1px 0;
    margin: 0 3px;
    border-bottom: 1px dashed #5e5e5e;
}

.a-label a:hover {
    opacity: 0.6;
    transform: translateY(-1px);
}

.a-title a {
  font-size: 18px;
  line-height: 45px;
  color: #5e5e5e;
  font-weight: bold;
}

.a-title a:hover {
  color: var(--color-font)
}

.read-detail {
  color: #499e8d
}

.a-brief-text {
  text-indent: 2em;
}

.update-time {
  display: block;
  margin-top: 0.6rem;
  font-size: 0.8rem;
  color: #9da09e;
}

.update-time span {
  color: #5e5e5e;
}

.pages {
  text-align: center;
  color: #9da09e;
}

.pages span, .pages a {
  padding: 3px;
  margin-right: 8px;
}

.pages .cur {
  font-size: 1.1rem;
  padding: 0;
  margin-right: 2px;
  color: #5e5e5e
}

.current-tag {
  color: #fff;
  background-color: rgb(111, 104, 177);
  font-size: 0.8rem;
  padding: 2px 2px 2px 5px;
  border-radius: 4px;
}

.clear-tag {
  color: #fff;
  font-weight: bold;
}

.publish-new {
  background-color: #499e8d;
  padding: 0px 4px;
  border-radius: 4px;
  margin-left: 20px;
}

.publish-new:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.publish-new a {
  color: #fff;
}

.operation {
  display: flex;
  justify-content: space-between;
}

.edit-delete i {
  margin-left: 10px;
  padding: 1px;
  font-size: 1.2rem;
  border-radius: 4px;
}

.edit-delete i:hover {
  border: 1px dashed #9da09e;
}

@media (min-width: 1024px) {
    .content-wrapper {
        margin: 100px auto 120px;
    }
}
</style>