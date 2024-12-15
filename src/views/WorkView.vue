<script setup>
import { useAuthStore } from '../stores/auth'
const authStore = useAuthStore()
</script>

<template>
  <main>
    <div class="item">
      <div class="details">
        <h3>
          <a href="/material">材料整理</a>
        </h3>
      </div>
    </div>
    <div class="item" v-if="authStore.isAuthenticated">
      <div class="details">
        <h3>
          <a href="/material/type">材料分类管理</a>
        </h3>
      </div>
    </div>
  </main>
</template>

<style scoped>
.item {
  margin-top: 2rem;
  display: flex;
  position: relative;
}

h3 {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
  color: var(--color-heading);
}
</style>