<script setup>
import Announcement from '../components/Announcement.vue'

</script>

<template>
  <div class="about-view">
    <!-- 使用通用公告组件，完全替代原来的内容 -->
    <Announcement 
      configKey="about" 
      title="关于" 
      :showTitle="true"
      :compact="false"
    />
  </div>
</template>

<style>
</style>
