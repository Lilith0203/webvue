<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../api'
import { message } from '../utils/message'

const commentsEnabled = ref(true) // 默认启用评论功能

// 公告管理相关状态
const announcementTabs = [
  { key: 'works', name: '作品页公告' },
  { key: 'story', name: '剧情页公告' },
  { key: 'about', name: '关于页公告' }
  // 可以添加更多页面的公告
]
const activeAnnouncementTab = ref('works')
const currentAnnouncement = ref('')
const announcementData = ref({})

// 评论管理相关变量
const pendingComments = ref([]) // 未审核评论列表
const approvedComments = ref([]) // 已审核评论列表
const activeTab = ref('pending') // 当前活动的评论标签：pending 或 approved
const isLoading = ref(false) // 加载状态

// 切换公告标签
const switchAnnouncementTab = (tabKey) => {
  activeAnnouncementTab.value = tabKey
  currentAnnouncement.value = announcementData.value[`announcement_${tabKey}`] || ''
}

// 加载公告数据
const loadAnnouncements = async () => {
  try {
    const keys = announcementTabs.map(tab => `announcement_${tab.key}`).join(',')
    const response = await axios.get('/config/load', {
      params: { keys }
    })
    
    if (response.data && response.data.success) {
      announcementData.value = response.data.data
      // 设置当前选中标签的公告内容
      currentAnnouncement.value = announcementData.value[`announcement_${activeAnnouncementTab.value}`] || ''
    }
  } catch (error) {
    console.error('加载公告失败:', error)
  }
}

// 保存当前公告
const saveAnnouncement = async () => {
  try {
    const key = `announcement_${activeAnnouncementTab.value}`
    await axios.post('/config/set', {
      [key]: currentAnnouncement.value
    })
    
    // 更新本地数据
    announcementData.value[key] = currentAnnouncement.value
    message.alert('公告保存成功')
  } catch (error) {
    console.error('保存公告失败:', error)
    message.alert('保存失败，请重试')
  }
}

// 清空当前公告
const clearAnnouncement = () => {
  currentAnnouncement.value = ''
}

// 格式化公告预览内容，将换行符转换为<p>标签，将链接格式转换为HTML链接
const formattedAnnouncementPreview = computed(() => {
  if (!currentAnnouncement.value) return '';
  
  // 将内容分割成段落
  const paragraphs = currentAnnouncement.value.split('\n').filter(line => line.trim() !== '');
  
  // 处理每个段落，转换链接和颜色格式
  return paragraphs.map(paragraph => {
    // 首先转换颜色标记 [color:red|文本内容]
    let withColors = paragraph.replace(/\[color:([a-z#0-9]+)\|(.*?)\]/g, '<span style="color:$1">$2</span>');
    
    // 然后转换链接格式 [文本](链接)
    const withLinks = withColors.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
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

// 加载设置、公告和未审核评论
onMounted(() => {
  loadSettings()
  loadComments('pending') // 默认加载未审核评论
  loadAnnouncements() // 加载公告数据
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

    <!-- 公告管理 -->
    <section class="setting-section">
      <h3>公告管理</h3>
      <div class="announcement-tabs">
        <button 
          v-for="tab in announcementTabs" 
          :key="tab.key"
          :class="['tab-button', { active: activeAnnouncementTab === tab.key }]"
          @click="switchAnnouncementTab(tab.key)"
        >
          {{ tab.name }}
        </button>
      </div>
      
      <div class="announcement-editor">
        <textarea 
          v-model="currentAnnouncement" 
          rows="5"
          placeholder="输入该页面的公告内容..."
          class="announcement-textarea"
        ></textarea>
        
        <div class="format-tips">
          支持链接格式：[链接文本](https://example.com)<br>
          支持彩色文字：[color:red|红色文字] 或 [color:#ff5500|自定义颜色]
        </div>
        
        <div class="preview-container" v-if="currentAnnouncement">
          <h4>预览</h4>
          <div class="announcement-preview" v-html="formattedAnnouncementPreview"></div>
        </div>
        
        <div class="edit-actions">
          <button @click="saveAnnouncement" class="save-btn">保存</button>
          <button @click="clearAnnouncement" class="cancel-btn">清空</button>
        </div>
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
.comment-tabs, .announcement-tabs {
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
.announcement-editor {
  width: 100%;
}

.announcement-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  line-height: 1.6;
  resize: vertical;
  margin-bottom: 10px;
}

.edit-actions {
  display: flex;
  justify-content: center; /* 居中显示按钮 */
  gap: 10px;
  margin-top: 15px;
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

/* 公告预览样式 */
.preview-container {
  margin-top: 15px;
}

.preview-container h4 {
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: #666;
}

.announcement-preview {
  padding: 10px;
  background-color: #fff7e6;
  border-left: 4px solid #ffb74d;
  border-radius: 4px;
  margin-bottom: 15px;
  line-height: 1.5;
  font-size: 0.9rem;
}

@media (min-width: 1024px) {
  .admin-panel {
    min-height: 100vh;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }
}

@media (max-width: 768px) {
  .admin-panel {
    padding: 0 15px;
  }
  
  .tab-button {
    padding: 6px 12px;
    font-size: 0.85rem;
  }
  
  .announcement-textarea, .about-textarea {
    font-size: 0.9rem;
  }
}
</style>