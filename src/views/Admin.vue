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
        <h2 class="header">网站配置</h2>
        <section class="comment">
          <div class="toggle-button" @click="toggleComments">
              <div class="toggle-indicator" :class="{ 'active': commentsEnabled }"></div>
          </div>
          <span>{{ commentsEnabled ? '评论功能已启用' : '评论功能已禁用' }}</span>
        </section>
        <button @click="saveSettings" class="save-button">保存设置</button>
    </div>
</template>

<style scoped>
.header {
  font-size: 1.3rem;
  margin-bottom: 20px;
}

.comment-management {
    margin-top: 20px;
    display: flex;
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
}

.comment {
  display: flex;
  align-items: center;
}

.toggle-button {
  width: 60px;
  height: 30px;
  background-color: #ccc;
  border-radius: 15px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.3s;
  margin-right: 20px;
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

.save-button {
  display: block;
  background-color: rgba(210,86,86,0.8);
  color: #fff;
  border: none;
  cursor: pointer;
  margin: 40px 0 0;
  border-radius: 4px;
  padding: 5px 6px;
  font-size: 0.9rem;
}

@media (min-width: 1024px) {
  .comment-management {
    min-height: 100vh;
  }
}
</style>