<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../api'

const commentsEnabled = ref(true) // 默认启用评论功能
const aboutContent = ref('') // 关于页面内容
const isEditingAbout = ref(false) // 是否正在编辑关于页面

// 格式化预览内容，将换行符转换为<p>标签，将链接格式转换为HTML链接
const formattedPreviewContent = computed(() => {
  if (!aboutContent.value) return '';
  
  // 将内容分割成段落
  const paragraphs = aboutContent.value.split('\n').filter(line => line.trim() !== '');
  
  // 处理每个段落，转换链接格式
  return paragraphs.map(paragraph => {
    // 转换链接格式 [文本](链接)
    const withLinks = paragraph.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    return `<p>${withLinks}</p>`;
  }).join('');
});

// 切换评论功能状态并立即保存
const toggleComments = async () => {
  commentsEnabled.value = !commentsEnabled.value;
  
  // 立即保存设置
  try {
    await axios.post('/config/set', {
      comment: commentsEnabled.value
    });
    // 可选：显示保存成功提示
    // alert('设置已保存');
  } catch (error) {
    console.error('保存配置失败:', error);
    alert('保存失败，请重试');
    // 如果保存失败，恢复原来的状态
    commentsEnabled.value = !commentsEnabled.value;
  }
}

const loadSettings = async() => {
  try {
    const response = await axios.get('/config/load')
    commentsEnabled.value = response.data.data.comment
  } catch (error) {
    console.error('获取配置失败:', error)
  }
}

// 加载关于页面内容
const loadAboutContent = async() => {
  try {
    const response = await axios.get('/about')
    aboutContent.value = response.data.data.content || ''
  } catch (error) {
    console.error('获取关于页面内容失败:', error)
  }
}

// 保存关于页面内容
const saveAboutContent = async() => {
  try {
    await axios.post('/admin/about', { content: aboutContent.value })
    isEditingAbout.value = false
  } catch (error) {
    console.error('保存关于页面内容失败:', error)
    alert('保存失败，请重试')
  }
}

// 开始编辑关于页面
const startEditAbout = () => {
  isEditingAbout.value = true
}

// 取消编辑关于页面
const cancelEditAbout = () => {
  isEditingAbout.value = false
  // 重新加载内容，放弃更改
  loadAboutContent()
}

// 格式化预览文本，保留换行（用于简短预览）
const formatPreviewText = (text, maxLength = 100) => {
  if (!text) return '';
  
  // 替换换行符为空格，避免在预览中显示换行
  const previewText = text.replace(/\n/g, ' ');
  
  if (previewText.length <= maxLength) {
    return previewText;
  }
  
  return previewText.substring(0, maxLength) + '...';
}

// 加载设置和关于页面内容
onMounted(() => {
  loadSettings()
  loadAboutContent()
})
</script>

<template>
  <div class="admin-panel">
    <h2 class="header">网站配置</h2>
    
    <!-- 评论设置 -->
    <section class="setting-section">
      <h3>评论设置</h3>
      <div class="comment">
        <div class="toggle-button" @click="toggleComments">
          <div class="toggle-indicator" :class="{ 'active': commentsEnabled }"></div>
        </div>
        <span>{{ commentsEnabled ? '评论功能已启用' : '评论功能已禁用' }}</span>
      </div>
    </section>
    
    <!-- 关于页面设置 -->
    <section class="setting-section">
      <h3>关于页面</h3>
      <div v-if="isEditingAbout" class="about-edit">
        <textarea 
          v-model="aboutContent" 
          class="about-textarea"
          rows="10"
          placeholder="请输入关于页面内容..."
        ></textarea>
        <div class="format-tips">
          支持链接格式：[链接文本](https://example.com)
        </div>
        <div class="edit-actions">
          <button @click="saveAboutContent" class="save-btn">保存</button>
          <button @click="cancelEditAbout" class="cancel-btn">取消</button>
        </div>
      </div>
      <div v-else class="about-preview">
        <div class="about-content-preview">
          <div v-if="aboutContent" v-html="formattedPreviewContent" class="preview-text"></div>
          <p v-else class="empty-content">暂无内容</p>
        </div>
        <button @click="startEditAbout" class="edit-btn">编辑内容</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.header {
  font-size: 1.2rem;
  margin-bottom: 20px;
}

.admin-panel {
  margin-top: 20px;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
  padding: 0 20px;
}

.setting-section {
  width: 100%;
  margin-bottom: 30px;
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
}

.setting-section h3 {
  font-size: 1rem;
  margin-bottom: 15px;
  color: #333;
}

.comment {
  display: flex;
  align-items: center;
}

.toggle-button {
  width: 56px;
  height: 26px;
  background-color: #ccc;
  border-radius: 15px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.3s;
  margin-right: 20px;
}

.toggle-indicator {
  width: 24px;
  height: 24px;
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

/* 关于页面编辑样式 */
.about-edit {
  width: 100%;
}

.about-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  line-height: 1.6;
  resize: vertical;
  margin-bottom: 10px;
}

.edit-actions {
  display: flex;
  justify-content: center; /* 居中显示按钮 */
  gap: 10px;
}

.save-btn, .cancel-btn, .edit-btn {
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  border: none;
  margin: 0 5px; /* 增加按钮之间的间距 */
}

.save-btn {
  background-color: var(--color-blue);
  color: white;
}

.cancel-btn {
  background-color: #f44336;
  color: white;
}

.edit-btn {
  margin-top: 10px;
  background-color: #499e8d;
  color: white;
}

.about-preview {
  width: 100%;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 4px;
}

.about-content-preview {
  flex: 1;
  overflow: auto;
  max-height: 200px; /* 限制最大高度 */
  margin-right: 10px;
}

.preview-text {
  margin: 0;
  text-align: left;
}

.preview-text p {
  margin-bottom: 8px;
  line-height: 1.5;
}

.empty-content {
  color: #999;
  font-style: italic;
}

.format-tips {
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 10px;
  background-color: #f0f0f0;
  padding: 8px;
  border-radius: 4px;
  line-height: 1.4;
}

@media (min-width: 1024px) {
  .admin-panel {
    min-height: 100vh;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }
}
</style>