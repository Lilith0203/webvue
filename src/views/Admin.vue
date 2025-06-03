<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../api'

const commentsEnabled = ref(true) // 默认启用评论功能
const aboutContent = ref('') // 关于页面内容
const isEditingAbout = ref(false) // 是否正在编辑关于页面

// 评论管理相关变量
const pendingComments = ref([]) // 未审核评论列表
const approvedComments = ref([]) // 已审核评论列表
const activeTab = ref('pending') // 当前活动的评论标签：pending 或 approved
const isLoading = ref(false) // 加载状态

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

// 加载评论列表
const loadComments = async (status) => {
  isLoading.value = true
  try {
    const response = await axios.get('/comments', {
      params: {
        approval: status
      }
    })
    
    if (status === 'pending') {
      pendingComments.value = response.data.comments || []
    } else {
      approvedComments.value = response.data.comments || []
    }
  } catch (error) {
    console.error(`获取${status === 'pending' ? '未审核' : '已审核'}评论失败:`, error)
  } finally {
    isLoading.value = false
  }
}

// 切换评论标签
const switchTab = (tab) => {
  activeTab.value = tab
  loadComments(tab === 'pending' ? 'pending' : 'approved')
}

// 审核评论
const approveComment = async (commentId, isApproved) => {
  try {
    await axios.post('/comment_approve', {
      id: commentId,
      isApproved: isApproved ? 1 : 0
    })
    
    // 从未审核列表中移除
    pendingComments.value = pendingComments.value.filter(comment => comment.id !== commentId)
    
    // 如果是批准，可以选择刷新已审核列表
    if (isApproved && activeTab.value === 'approved') {
      loadComments('approved')
    }
  } catch (error) {
    console.error('审核评论失败:', error)
    alert('审核操作失败，请重试')
  }
}

// 删除评论
const deleteComment = async (commentId) => {
  if (!confirm('确定要删除此评论吗？')) return
  
  try {
    await axios.post('/comment_delete', {
      id: commentId
    })
    
    // 从列表中移除
    if (activeTab.value === 'pending') {
      pendingComments.value = pendingComments.value.filter(comment => comment.id !== commentId)
    } else {
      approvedComments.value = approvedComments.value.filter(comment => comment.id !== commentId)
    }
  } catch (error) {
    console.error('删除评论失败:', error)
    alert('删除操作失败，请重试')
  }
}

// 获取评论类型名称
const getCommentTypeName = (type) => {
  const types = {
    1: '文章',
    2: '作品',
    // 可以添加更多类型
  }
  return types[type] || '未知'
}

// 加载设置、关于页面内容和未审核评论
onMounted(() => {
  loadSettings()
  loadAboutContent()
  loadComments('pending') // 默认加载未审核评论
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
    
    <!-- 评论管理 -->
    <section class="setting-section">
      <h3>评论管理</h3>
      <div class="comment-tabs">
        <button 
          :class="['tab-button', { active: activeTab === 'pending' }]"
          @click="switchTab('pending')"
        >
          待审核评论
          <span v-if="pendingComments.length" class="comment-count">{{ pendingComments.length }}</span>
        </button>
        <button 
          :class="['tab-button', { active: activeTab === 'approved' }]"
          @click="switchTab('approved')"
        >
          已审核评论
        </button>
      </div>
      
      <div class="comment-list">
        <div v-if="isLoading" class="loading">加载中...</div>
        
        <div v-else-if="activeTab === 'pending' && pendingComments.length === 0" class="no-comments">
          没有待审核的评论
        </div>
        
        <div v-else-if="activeTab === 'approved' && approvedComments.length === 0" class="no-comments">
          没有已审核的评论
        </div>
        
        <div v-else class="comments">
          <div 
            v-for="comment in activeTab === 'pending' ? pendingComments : approvedComments" 
            :key="comment.id"
            class="comment-item"
          >
            <div class="comment-header">
              <span class="comment-author">{{ comment.name }}</span>
              <span class="comment-time">{{ comment.createdAt }}</span>
              <span class="comment-type">{{ getCommentTypeName(comment.type) }}评论</span>
            </div>
            
            <div class="comment-content">{{ comment.content }}</div>
            
            <div class="comment-actions">
              <template v-if="activeTab === 'pending'">
                <button @click="approveComment(comment.id, true)" class="approve-btn">
                  通过
                </button>
                <button @click="approveComment(comment.id, false)" class="reject-btn">
                  拒绝
                </button>
              </template>
              <button @click="deleteComment(comment.id)" class="delete-btn">
                删除
              </button>
            </div>
            
            <!-- 显示回复评论 -->
            <div v-if="comment.replies && comment.replies.length > 0" class="comment-replies">
              <div v-for="reply in comment.replies" :key="reply.id" class="reply-item">
                <div class="comment-header">
                  <span class="comment-author">{{ reply.name }}</span>
                  <span class="comment-time">{{ reply.createdAt }}</span>
                  <span class="comment-type">回复</span>
                </div>
                <div class="comment-content">{{ reply.content }}</div>
                <div class="comment-actions">
                  <template v-if="activeTab === 'pending' && reply.isApproved === 0">
                    <button @click="approveComment(reply.id, true)" class="approve-btn">
                      通过
                    </button>
                    <button @click="approveComment(reply.id, false)" class="reject-btn">
                      拒绝
                    </button>
                  </template>
                  <button @click="deleteComment(reply.id)" class="delete-btn">
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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

/* 评论管理样式 */
.comment-tabs {
  display: flex;
  margin-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.tab-button {
  padding: 8px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  position: relative;
  color: #666;
}

.tab-button.active {
  color: #499e8d;
  border-bottom: 2px solid #499e8d;
}

.comment-count {
  position: absolute;
  top: 0;
  right: 0;
  background-color: #f44336;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 0.7rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.comment-list {
  width: 100%;
}

.loading, .no-comments {
  text-align: center;
  padding: 20px;
  color: #666;
}

.comment-item {
  margin-bottom: 20px;
  padding: 15px;
  border-radius: 4px;
  background-color: #f9f9f9;
  border-left: 3px solid #499e8d;
}

.comment-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.comment-author {
  font-weight: bold;
  margin-right: 10px;
}

.comment-time {
  color: #999;
  font-size: 0.8rem;
  margin-right: 10px;
}

.comment-type {
  font-size: 0.8rem;
  background-color: #e0e0e0;
  padding: 2px 6px;
  border-radius: 10px;
}

.comment-content {
  margin-bottom: 10px;
  line-height: 1.5;
  word-break: break-word;
}

.comment-actions {
  display: flex;
  gap: 10px;
}

.approve-btn, .reject-btn, .delete-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.approve-btn {
  background-color: #4CAF50;
  color: white;
}

.reject-btn {
  background-color: #FF9800;
  color: white;
}

.delete-btn {
  background-color: #f44336;
  color: white;
}

.comment-replies {
  margin-top: 10px;
  margin-left: 20px;
  border-left: 2px solid #ddd;
  padding-left: 15px;
}

.reply-item {
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f0f0f0;
  border-radius: 4px;
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