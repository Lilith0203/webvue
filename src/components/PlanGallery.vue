<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../api' // Assuming you have an axios instance configured
import { useRouter } from 'vue-router'

const router = useRouter()
const plans = ref([])
const loading = ref(false)
const error = ref(null)
const gridColumns = ref(3) // Default columns, can be adjusted

// Fetch plan data
const fetchPlans = async () => {
  loading.value = true
  error.value = null
  try {
    // Adjust size based on columns if needed, fetching 6 for now
    const response = await axios.get('/plans', {
      params: {
        page: 1,
        size: 6
      }
    })
    plans.value = response.data.items || []
  } catch (err) {
    error.value = "获取计划失败：" + err.message
    console.error('Fetch plans error:', err)
  } finally {
    loading.value = false
  }
}

// Adjust grid columns based on screen width (similar to WorkGallery)
const adjustGridColumns = () => {
  const width = window.innerWidth
  if (width >= 1200) {
    gridColumns.value = 3 // Or adjust as needed
  } else if (width >= 768) {
    gridColumns.value = 3
  } else {
    gridColumns.value = 2 // Maybe fewer columns on small screens
  }
}

// Lifecycle hooks
onMounted(() => {
  adjustGridColumns()
  fetchPlans()
  window.addEventListener('resize', adjustGridColumns)
})

import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  window.removeEventListener('resize', adjustGridColumns)
})

// Navigate to the main plans page (assuming '/plans')
const goToPlansPage = () => {
  router.push('/plans')
}
</script>

<template>
  <div class="plan-gallery">
    <div class="gallery-title" @click="goToPlansPage">
      <h3>
        <i class="iconfont icon-huawen2"></i> <!-- Use appropriate icons -->
        <a>近期计划</a>
        <i class="iconfont icon-huawen1"></i> <!-- Use appropriate icons -->
      </h3>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="!loading && !error && plans.length > 0" class="gallery-grid" :style="{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }">
      <div v-for="plan in plans" :key="plan.id" class="gallery-item">
        <div class="item-content">
          <h4 class="item-title">{{ plan.title }}</h4>
          <p class="item-description">{{ plan.description }}</p>
          <span v-if="plan.status" class="item-status">{{ plan.status }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="!loading && !error" class="empty-state">
      暂无计划
    </div>

    <span class="more" v-if="plans.length > 0">
      <a href="/plans" @click.prevent="goToPlansPage">More</a>
    </span>
  </div>
</template>

<style scoped>
/* Reuse styles from WorkGallery or ArticleGallery, adjust as needed */
.plan-gallery {
  margin: 0.5rem 0 0.4rem 0;
  padding: 10px; /* Add padding */
}

.gallery-title {
  margin-bottom: 20px; /* Increased margin */
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.gallery-title h3 {
  padding: 0 36px;
  border-bottom: 1px solid #949494;
  display: inline-flex; /* Ensure icons and text are inline */
  align-items: center;
}

.gallery-title a {
  font-size: 1.1rem;
  color: var(--color-text);
  padding: 0 10px;
  font-weight: bold;
  text-decoration: none; /* Ensure no underline */
}

.gallery-title a:hover {
  color: var(--color-blue);
}

.icon-huawen1, .icon-huawen2 {
  font-size: 1.5rem; /* Or adjust icon size */
  color: var(--color-text);
}

.gallery-grid {
  display: grid;
  gap: 20px; /* Gap between items */
}

.gallery-item {
  background-color: var(--color-background-mute); /* Slightly different background */
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid var(--color-border);
}

.gallery-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
}

.item-content {
  /* Style for content inside the plan item */
}

.item-title {
  font-size: 1rem;
  font-weight: bold;
  color: var(--color-heading);
  margin-bottom: 8px;
}

.item-description {
  font-size: 0.9rem;
  color: var(--color-text);
  margin-bottom: 10px;
  line-height: 1.5;
}

.item-status {
  display: inline-block;
  font-size: 0.8rem;
  color: var(--color-accent); /* Use accent color for status */
  background-color: var(--color-background);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--color-border-hover);
}

.more {
  display: block;
  text-align: center;
  margin-top: 20px; /* Space above more link */
}

.more a {
  color: #499e8d; /* Style more link */
  text-decoration: none;
}

.more a:hover {
  text-decoration: underline;
}

/* Loading, error, empty states */
.loading, .error, .empty-state {
  text-align: center;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}
.error {
  color: #dc3545;
}

</style>
