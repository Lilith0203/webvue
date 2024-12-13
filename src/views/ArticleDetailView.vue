<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from '../api'

const route = useRoute()
const article = ref(null)
const loading = ref(false)
const error = ref(null)

const fetchArticle = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await axios.get(`/article/${route.params.id}`)
    article.value = response.data.article
  } catch (err) {
    error.value = "获取文章失败：" + err.message
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
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
      <div class="meta">
        <span class="date">最后更新时间: {{ article.updatedAt }}</span>
        <p v-if="article.tags" class="tags">Tags：{{ article.tags }}</p>
      </div>
      <div class="article-content" v-html="article.content"></div>
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
    text-align: center;
}

:deep(.article-content) {
    p, ul, ol {
        text-indent: 2em;
        line-height: 1.5;
        margin-bottom: 6px;
        text-align: left;
    }

    h1 {
        line-height: 2;
        margin-top: 10px;
        font-weight: bold;
        text-align: left;
    }

    a {
        color: #4a9dd9;
        border-bottom: 1px dashed #C9DFFB;
    }

    .demo {
        display: inline-block;
        width: 60px;
        background-color: #4a9dd9;
        color: #fff;
        font-weight: bold;
        text-align: center;
        line-height: 1.8;
        border: 1px dashed #fff;
    }

    .demo:hover {
        background-color: #C9DFFB;
    }

    code {
        display: block;
        white-space: pre-wrap;
        text-align: left;
        margin: 10px 35px;
    }

    img {
        max-width: 100%;
        border: 3px solid #fff;
        box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.2);
        margin: 8px 0;
    }

    blockquote {
        font-style: italic;
        font-size: 13px;
        text-align: left;
        color: #3E3E3E;
    }
}

@media (min-width: 1024px) {
    .article-detail {
        margin: 100px auto 120px;
    }
}
</style>