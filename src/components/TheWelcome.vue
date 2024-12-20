<script setup>
import axios from '../api'
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import WorkGallery from '../components/WorkGallery.vue'

const authStore = useAuthStore()

const backendData = ref(null)
const loading = ref(false)
const error = ref(null)

const fetchData = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await axios.get('/article?size=5')
    backendData.value = response.data
  } catch (err) {
    error.value = "获取数据失败：" + err.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <WorkGallery />
    <div class="details">
      <h3 class="article-title">
        <i class="iconfont icon-huawen2"></i>
        <a :href="`/article`">文章</a>
        <i class="iconfont icon-huawen1"></i>
      </h3>
      <div v-if="loading">加载中……</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-if="backendData">
        <span>共 {{ backendData.count }} 篇</span>
        <ul class="article-list">
          <li v-for="article in backendData.articles" :key="article.id">
            <a :href="`/article/${article.id}`">{{ article.title }}</a>
          </li>
        </ul>
        <span><a :href="`/article`">更多…</a></span>
      </div>
    </div>
</template>

<style scoped>
.details {
  flex: 1;
  margin-top: 5px;
}

.article-title {
    font-size: 1rem;
    color: var(--color-heading);
    margin-bottom: 10px;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }

  .article-title a:hover {
    color: var(--color-blue);
  }

  .article-title a {
    color: var(--color-text);
    padding: 0 10px;
  }

  .icon-huawen1, .icon-huawen2 {
    font-size: 1.5rem;
    color: var(--color-text);
  }

@media (min-width: 1024px) {
  .article-title {
    font-size: 1.1rem;
  }

  i.icon-bzhan {
    top: calc(50% - 25px);
    left: -26px;
    position: absolute;
    border: 1px solid var(--color-border);
    background: var(--color-background);
    border-radius: 8px;
    width: 50px;
    height: 50px;
  }
}
</style>