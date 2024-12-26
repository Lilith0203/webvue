<script setup>
import { ref } from 'vue'
import axios from '../api'

const commentsEnabled = ref(true) // 默认启用评论功能

// 切换评论功能状态
const toggleComments = () => {
  commentsEnabled.value = !commentsEnabled.value;
}

// 从本地存储加载设置
const loadSettings = async() => {
try {
    const response = await axios.get('/config/load')
    commentsEnabled.value = response.data.data.comment
  } catch (error) {
    console.error('获取配置失败:', error)
  } finally {
  }
}

// 保存设置到本地存储
const saveSettings = async() => {
    const response = await axios.post('/config/set', {
        comment: commentsEnabled.value
    })
}

// 加载设置
loadSettings()
</script>

<template>
    <div class="comment-management">
        <h2>评论管理</h2>
        <div class="toggle-button" @click="toggleComments">
            <div class="toggle-indicator" :class="{ 'active': commentsEnabled }"></div>
        </div>
        <span>{{ commentsEnabled ? '评论功能已启用' : '评论功能已禁用' }}</span>
    </div>
    <button @click="saveSettings">保存设置</button>
</template>

<style scoped>
.comment-management {
    margin-top: 20px;
}

.toggle-button {
  width: 60px;
  height: 30px;
  background-color: #ccc;
  border-radius: 15px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.3s;
}

.toggle-indicator {
  width: 28px;
  height: 28px;
  background-color: white;
  border-radius: 50%;
  position: absolute;
  top: 1px;
  left: 1px;
  transition: transform 0.3s;
}

.toggle-indicator.active {
  transform: translateX(30px); /* 移动到右侧 */
  background-color: #499e8d; /* 切换开启时的颜色 */
}

.toggle-button.active {
  background-color: #499e8d; /* 切换开启时的背景颜色 */
}
</style>