<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import { confirm } from '../utils/confirm'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAuthenticated && authStore.user?.role === 'admin')

const menu = ref(null)
const loading = ref(false)
const error = ref('')

const fetchMenu = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.get(`/menus/${route.params.id}`)
    if (!res.data?.success) throw new Error(res.data?.message || '获取菜单失败')
    menu.value = res.data.data
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || '获取菜单失败'
  } finally {
    loading.value = false
  }
}

const handleDelete = async () => {
  if (!isAdmin.value || !menu.value?.id) return
  if (!(await confirm('确定要删除这个菜单吗？'))) return
  await axios.post('/menus/delete', { id: menu.value.id })
  router.push('/kitchen')
}

onMounted(fetchMenu)
</script>

<template>
  <main>
    <div class="content-wrapper">
      <div class="head">
        <span class="back" @click="router.push('/kitchen')">← 返回</span>
        <div class="actions" v-if="isAdmin && menu">
          <button class="btn" @click="router.push(`/menu/${menu.id}/edit`)"><i class="iconfont icon-edit"></i></button>
          <button class="btn danger" @click="handleDelete"><i class="iconfont icon-ashbin"></i></button>
        </div>
      </div>

      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>

      <div v-else-if="menu" class="card">
        <h2 class="title">{{ menu.name }}</h2>
        <div class="meta" v-if="menu.staple"><span class="label">主食：</span>{{ menu.staple }}</div>

        <div v-if="menu.pictures && menu.pictures.length" class="pics">
          <img v-for="(u, idx) in menu.pictures" :key="idx" :src="u" class="pic" />
        </div>

        <section v-if="menu.ingredients" class="section">
          <h3>配料</h3>
          <pre class="pre">{{ menu.ingredients }}</pre>
        </section>
        <section v-if="menu.steps" class="section">
          <h3>步骤</h3>
          <pre class="pre">{{ menu.steps }}</pre>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
h3 {
  font-size: 0.9rem;
}
.content-wrapper { max-width: 900px; margin: 20px auto; }
.head { display:flex; align-items:center; justify-content: space-between; margin-bottom: 10px; }
.back { color:#499e8d; cursor:pointer; }
.actions { display:flex; gap: 10px; }
.btn { 
  border: none;
  padding: 0; 
  background:transparent; 
  cursor:pointer; 
}

.btn i{ 
  font-size: 1.2rem;
}

.btn.danger { border-color:#e7b1b1; color:#c0392b; }
.card { border:1px dashed #e6e6e6; border-radius: 8px; padding: 14px; background:#fff; }
.title { 
  margin: 0 0 8px; 
  font-size: 1.2rem; 
}
.meta { color:#666; margin-bottom: 10px; }
.label { color:#888; }
.pics { display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin: 10px 0; }
.pic { width:100%; border-radius: 8px; border:1px solid #eee; object-fit: cover; }
.section { margin-top: 12px; }
.pre { white-space: pre-wrap; background:#fafafa; border:1px solid #eee; padding:10px; border-radius: 6px; }
.loading,.error { text-align:center; padding: 40px; }
.error { color:#dc3545; }
</style>

