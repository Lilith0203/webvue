<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

const apps = ref([
  {
    id: 1,
    title: '妙手回春---Web游戏',
    description: '大学时期作品，仅支持pc端',
    image: '/images/03092015013116.png',
    link: '/programs/spring/index.html'
  },
  {
    id: 2,
    title: '圣诞Jump---Web游戏',
    description: '大学时期作品',
    image: '/images/03092015014024.png',
    link: '/programs/santa/index.html'
  },
  {
    id: 3,
    title: '文字识别（OCR）',
    description: '上传图片，提取文字',
    image: '/images/wlink-bg.png',
    link: '/ocr'
  }
])

const isExternalLink = (link) => /^https?:\/\//i.test(link) || /\.html(\?|#|$)/i.test(link)
</script>

<template>
  <div class="showcase">
    <div class="app-list">
      <div class="app-card" v-for="app in apps" :key="app.id">
        <div class="info">
          <h2 class="app-title">{{ app.title }}</h2>
          <p class="app-description">{{ app.description }}</p>
          <p>
            <a
              v-if="isExternalLink(app.link)"
              :href="app.link"
              class="app-link"
              target="_blank"
              rel="noopener"
            >
              查看详情
            </a>
            <RouterLink v-else :to="app.link" class="app-link">查看详情</RouterLink>
          </p>
        </div>
        <div>
          <img :src="app.image" alt="App Image" class="app-image" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.showcase {
  margin-top: 15px;
}

.app-card {
  display: flex;
  padding-bottom: 20px;
  margin-bottom: 25px;
  border-bottom: 1px dashed #dfdfdf;
}

.info {
  width: 210px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin-right: 20px;
}

.info h2 {
  font-size: 1.1rem;
  font-weight: bold;
}

.app-image {
  max-width: 240px;
  min-height: 100px;
  border: 2px solid #fff;
  box-shadow: 0px 0px 3px rgba(0,0,0,0.2);
}

.app-link {
  display: inline-block;
  background: transparent url(/images/wlink-bg.png) no-repeat center right;
  color: #d55355;
  width: 90px;
  transition: 0s;
}

.app-link:hover {
  color: #4c9ed9;
  background-position: left;
}

@media (min-width: 1024px) {
  .app-image {
    max-width: 400px;
  }
}
</style>