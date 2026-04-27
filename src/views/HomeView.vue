<script setup>
import { computed } from 'vue'
import WorkGallery from '../components/WorkGallery.vue'
import ArticleGallery from '../components/ArticleGallery.vue'
import PlanGallery from '../components/PlanGallery.vue'
import AboutView from './AboutView.vue'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const showPlans = computed(() => authStore.isAuthenticated)
</script>

<template>
  <main>
    <AboutView />
    <WorkGallery />
    <ArticleGallery />
    <PlanGallery v-if="showPlans" />
  </main>
</template>
