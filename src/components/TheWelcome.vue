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
  <div class="item">
    <div class="details">
      <h3>
        文章
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
  </div>
</template>

<style scoped>
.item {
  margin-top: 0.6rem;
  display: flex;
  position: relative;
  margin-bottom: 1rem;
}

.details {
  flex: 1;
  margin-left: 1rem;
}

h3 {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
  color: var(--color-heading);
}

@media (min-width: 1024px) {
  .item {
    margin-top: 0;
    padding: 0.4rem 0 1rem calc(var(--section-gap) / 2);
    border-left: 1px dashed var(--color-border);
  }

  i {
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