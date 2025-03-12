<script setup>
import axios from '../api'
import { ref, onMounted } from 'vue'
import { getTagColor, getTextColor, initTagColors } from '../utils/tags'
import { useRouter } from 'vue-router'
const router = useRouter()

const backendData = ref(null)
const loading = ref(false)
const error = ref(null)

const fetchData = async () => {
  loading.value = true
  error.value = null

  try {
    const response = await axios.get('/article?size=8')
    backendData.value = response.data
  } catch (err) {
    error.value = "获取数据失败：" + err.message
  } finally {
    loading.value = false
  }
}

// 格式化日期的函数
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString() // 只返回日期部分
}

const getTagStyle = (tag) => {
  const bgColor = getTagColor(tag)
  const textColor = getTextColor(bgColor)
  return {
    backgroundColor: bgColor,
    color: textColor,
    fontSize: '0.7rem'
  }
}

onMounted(async () => {
  await initTagColors()  // 初始化标签颜色
  fetchData()           // 获取文章数据
})
</script>

<template>
    <div class="details">
      <div class="article-title">
      <h3>
        <i class="iconfont icon-huawen2"></i>
        <a href="/article" @click.prevent="router.push('/article')">文章</a>
        <i class="iconfont icon-huawen1"></i>
      </h3>
    </div>
      <div v-if="loading">加载中……</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-if="backendData" class="article-list">
        <span class="article-count">共 {{ backendData.count }} 篇</span>
        <section v-for="article in backendData.articles" :key="article.id">
          <div class="article-head">
          <span class="tags">
                <a v-for="tag in article.tags"
                   href="`/article?tag=${tag}`"
                   @click.prevent="router.push(`/article?tag=${tag}`)"
                   :key="tag"
                   class="tag"
                   :style="getTagStyle(tag)">
                   {{ tag }}
                </a>
          </span>
            
          <a href="#" @click.prevent="router.push(`/article/${article.id}`)">{{ article.title }}</a>
          </div>
          <div class="article-time">
            {{ formatDate(article.createdAt) }}
          </div>
        </section>
        <span class="more"><a href="/article" @click.prevent="router.push('/article')">More</a></span>
      </div>
    </div>
</template>

<style scoped>
.article-title {
    color: var(--color-heading);
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    margin-bottom: 10px;
  }

  .article-title h3 {
    padding: 0 36px;
    border-bottom: 1px solid #949494;
  }

  .article-title a:hover {
    color: var(--color-blue);
  }

  .article-title a {
    font-size: 1.1rem;
    color: var(--color-text);
    padding: 0 10px;
    font-weight: bold;
  }

.article-list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin: 0 10px;
}

.article-list section {
  width: 100%;
  text-align: center;
  line-height: 2;
}

.article-list a {
  color: var(--color-text);
}

.article-list a:hover {
  color: hsla(160, 100%, 37%, 1);
}

.article-count {
  color: #949494;
}

.more a {
  color: #499e8d;
}

.icon-huawen1, .icon-huawen2 {
    font-size: 1.5rem;
    color: var(--color-text);
}

.tags a {
    margin-right: 5px;
    padding: 2px 5px;
    border-radius: 4px;
    color: #fff;
    transition: all 0.3s ease;
}

.tag:hover {
    opacity: 0.6;
    transform: translateY(-1px);
}

.article-list section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.article-head, .article-time {
  display: inline-flex;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.article-time {
  font-size: 0.8rem;
  color: #9da09e;
}

@media (min-width: 1024px) {
  .article-title {
    font-size: 1.1rem;
  }
}
</style>