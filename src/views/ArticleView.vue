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
    const size = route.query.size || 10
    const response = await axios.get(`/article?`, {
      params: {
        page,
        size
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
  try {
    await axios.post(`/article/delete`, {id:id})
    router.push('/article')
    await fetchData()
  } catch (error) {
    console.error('删除失败:', error)
    alert('删除文章失败：' + error.message)
  } finally {
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
        <p id="all-info" v-if="backendData">共 <span>{{backendData.count}}</span> 篇文章
          <span v-if="authStore.isAuthenticated"><a :href="`/publish`">发布新文章</a></span>
        </p>
      </div>
      <div class="list-wrapper" v-if="backendData">
        <article class="a-brief" v-for="article in backendData.articles" :key="article.id">
          <h1 class="a-title"><a :href="`/article/${article.id}`">{{article.title}}</a></h1>
          <time :datetime="article?.createdAt">
            <span class="time-date">{{ article.createdAt }}</span><br/>
          </time>
          <div v-if="article.tags" class="a-label">Tag: &nbsp;
            <a v-for="tag in article.tags">{{tag}}</a>
          </div>
          <div class="a-brief-text">
            <p>{{article.abbr}}
              <a :href="`/article/${article.id}`" class="read-detail">（阅读全文）</a>
              <span v-if="authStore.isAuthenticated"><a :href="`/article/${article.id}/edit`">编辑</a></span>
              <a href="#" @click.prevent="handleDelete(article.id)">删除</a>
            </p>
          </div>
        </article>

        <div class="pages">
          <span class='cur'>当前页：{{backendData.page_now}}/{{backendData.page_all}}页</span>
          <a v-if="backendData.page_now !== 1" :href="`/article?page=${backendData.page_now-1}`" class='able'>上一页</a>
          <a v-if="backendData.page_now !== backendData.page_all" :href="`/article?page=${backendData.page_now+1}`" class='able'>下一页</a>
          <a :href="`/article?page=${backendData.page_all}`" class='able'>尾页</a>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.content-wrapper {
    margin: 20px auto 20px;
}

.a-brief {
  margin-bottom: 10px;
  border-bottom: 1px dashed #e4e4e4;
  padding-bottom: 20px;
}

.a-title {
  font-size: 18px;
  line-height: 45px;
}

.time-date {
  font-size: 14px;
  color: #999;
}

.a-label {
  font-size: 14px;
  line-height: 1.8em;
}

.a-brief-text {
  text-indent: 2em;
}

.pages span, .pages a {
  padding: 3px;
  margin-right: 8px;
}

@media (min-width: 1024px) {
    .content-wrapper {
        margin: 100px auto 120px;
    }
}
</style>