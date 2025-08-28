<script setup>
import { ref,defineProps } from 'vue'
import { useAuthStore } from '../stores/auth'
import { message } from '../utils/message'
import { isValidComment } from '../utils/validation'

const authStore = useAuthStore()
const lastCommentTime = ref(0);
const commentCooldown = 10000; // 10秒冷却时间

// 评论截断字符数配置
const COMMENT_TRUNCATE_LENGTH = 100

const props = defineProps({
  comments: {
    type: Array,
    default: () => []
  },
  onCommentSubmit: {
    type: Function,
    required: true
  },
  onCommentDelete: {
    type: Function,
    required: true
  }
})
  
const newComment = ref({
  name: '',
  content: ''
})

// 回复相关状态
const replyingTo = ref(null) // 当前正在回复的评论ID
const replyForm = ref({
  name: '',
  content: ''
})

// 为每条评论维护展开状态
const expandedComments = ref({})

const toggleExpand = (id) => {
  expandedComments.value[id] = !expandedComments.value[id]
}

// 计算需要截断的文本长度，为展开按钮留出空间
const getTruncatedText = (text, maxLength = COMMENT_TRUNCATE_LENGTH) => {
  if (text.length <= maxLength) return text;
  
  // 简单截断，为"展开"按钮预留空间
  const truncated = text.substring(0, maxLength);
  return truncated;
}
  
// 提交评论
const submitComment = () => {
  if (!newComment.value.name || !newComment.value.content) {
    message.alert('请填写姓名和评论内容')
    return
  }
  
  const currentTime = Date.now();
  if (currentTime - lastCommentTime.value < commentCooldown) {
    message.alert('请稍等再提交评论。');
    return;
  }

  const validation1 = isValidComment(newComment.value.content);
  if (!validation1.valid) {
    message.alert(validation1.message); // 显示验证错误信息
    newComment.value.name = ''
    newComment.value.content = ''
    return;
  }
  const validation2 = isValidComment(newComment.value.name);
  if (!validation2.valid) {
    message.alert(validation2.message); // 显示验证错误信息
    newComment.value.name = ''
    newComment.value.content = ''
    return;
  }
  
  const commentData = {
    name: newComment.value.name,
    content: newComment.value.content,
    reply: 0  // 初始化回复数组
  }
  
  // 调用父组件的提交评论方法
  props.onCommentSubmit(commentData)
  lastCommentTime.value = currentTime; // 更新最后提交时间

  // 显示评论提交成功、等待审核的消息
  message.alert('评论提交成功，审核通过后将会显示。')
  
  // 清空输入框
  newComment.value.name = ''
  newComment.value.content = ''
}

const commentDelete = async(commentId) => {
  props.onCommentDelete(commentId)
}

// 开始回复
const startReply = (commentId) => {
  replyingTo.value = commentId
  replyForm.value = {
    name: '',
    content: ''
  }
}

// 取消回复
const cancelReply = () => {
  replyingTo.value = null
  replyForm.value = {
    name: '',
    content: ''
  }
}

// 提交回复
const submitReply = () => {
  if (!replyForm.value.name || !replyForm.value.content) {
    message.alert('请填写姓名和回复内容')
    return
  }

  const currentTime = Date.now();
  if (currentTime - lastCommentTime.value < commentCooldown) {
    message.alert('请稍等再提交回复。');
    return;
  }

  const validation1 = isValidComment(replyForm.value.content);
  if (!validation1.valid) {
    message.alert(validation1.message);
    return;
  }
  const validation2 = isValidComment(replyForm.value.name);
  if (!validation2.valid) {
    message.alert(validation2.message);
    return;
  }

  const replyData = {
    name: replyForm.value.name,
    content: replyForm.value.content,
    reply: replyingTo.value // 回复的评论ID
  }

  // 调用父组件的提交评论方法
  props.onCommentSubmit(replyData)
  lastCommentTime.value = currentTime;

  message.alert('回复提交成功，审核通过后将会显示。')
  
  // 清空回复表单并关闭回复框
  cancelReply()
}

const handleCommentClick = (event, commentId) => {
  // 只在折叠状态下处理点击
  if (!expandedComments.value[commentId]) {
    toggleExpand(commentId);
  }
}
</script>

<template>
  <div class="comments-section">
    <h3 class="comment-title">最新评论.</h3>
    <div class="comments-list">
      <div v-for="comment in comments" :key="comment.id" class="comment-item">
        <div class="comment-header">
          <p class="comm-name">From: <span>{{ comment.name }}</span></p>
          <span class="comm-time">{{ comment.createdAt }}</span>
        </div>
        <div class="comment-content">
          <div
            :class="expandedComments[comment.id] ? 'comm-text-expanded' : 'comm-text-collapsed'"
            :data-comment-id="comment.id"
            @click="!expandedComments[comment.id] && comment.content.length > COMMENT_TRUNCATE_LENGTH && toggleExpand(comment.id)"
          >
            <span v-if="!expandedComments[comment.id]">
              {{ getTruncatedText(comment.content) }}
              <span v-if="comment.content.length > COMMENT_TRUNCATE_LENGTH">...</span>
              <!-- 折叠状态下显示展开按钮 -->
              <button 
                v-if="comment.content.length > COMMENT_TRUNCATE_LENGTH"
                class="expand-btn" 
                @click.stop="toggleExpand(comment.id)"
                type="button"
              >
                展开
              </button>
            </span>
            <span v-else>
              {{ comment.content }}
              <!-- 展开状态下显示收起按钮 -->
              <button 
                v-if="comment.content.length > COMMENT_TRUNCATE_LENGTH"
                class="collapse-btn" 
                @click.stop="toggleExpand(comment.id)"
                type="button"
              >
                收起
              </button>
            </span>
          </div>
          <div class="op">
            <a v-if="authStore.isAuthenticated" href="#" class="reply-link" @click.prevent="startReply(comment.id)" role="button" tabindex="0">回复</a>
            <a v-if="authStore.isAuthenticated" 
              href="#" class="delete-link"
              @click.prevent="commentDelete(comment.id)" role="button" tabindex="0">删除</a>
          </div>
        </div>
        
        <!-- 回复表单 -->
        <div v-if="replyingTo === comment.id" class="reply-form">
          <h4>回复 {{ comment.name }}：</h4>
          <form @submit.prevent="submitReply">
            <label for="reply-name">Name：</label>
            <input v-model="replyForm.name" type="text" id="reply-name" placeholder="昵称请不要多于10个字" required>
            <label for="reply-content" class="sr-only">回复内容：</label>
            <textarea v-model="replyForm.content" id="reply-content" placeholder="添加回复..." rows="3" required></textarea>
            <div class="reply-actions">
              <button type="submit" class="reply-submit">发表回复</button>
              <button type="button" class="reply-cancel" @click="cancelReply">取消</button>
            </div>
          </form>
        </div>
        
        <!-- 如果有回复，可以在这里递归显示 -->
        <div v-if="comment.replies && comment.replies.length" class="replies-section">
          <h4 class="replies-title">回复:</h4>
          <div class="replies-list">
            <div v-for="reply in comment.replies" :key="reply.id" class="reply-item">
              <div class="reply-content">
                {{ reply.content }}
              </div>
              <div class="reply-op">
                <a v-if="authStore.isAuthenticated" 
                  href="#" class="delete-link"
                  @click.prevent="commentDelete(reply.id)" role="button" tabindex="0">删除</a>
              </div>
              
              <!-- 回复的回复表单 -->
              <div v-if="replyingTo === reply.id" class="nested-reply-form">
                <h5>回复 {{ reply.name }}：</h5>
                <form @submit.prevent="submitReply">
                  <label for="nested-reply-name">Name：</label>
                  <input v-model="replyForm.name" type="text" id="nested-reply-name" placeholder="昵称请不要多于10个字" required>
                  <label for="nested-reply-content" class="sr-only">回复内容：</label>
                  <textarea v-model="replyForm.content" id="nested-reply-content" placeholder="添加回复..." rows="2" required></textarea>
                  <div class="reply-actions">
                    <button type="submit" class="reply-submit">发表回复</button>
                    <button type="button" class="reply-cancel" @click="cancelReply">取消</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <form class="comment-form" @submit.prevent="submitComment">
      <label for="comment-name">Name：</label>
      <input v-model="newComment.name" type="text" id="comment-name" placeholder="昵称请不要多于10个字" required>
      <label for="comment-content" class="sr-only">评论内容：</label>
      <textarea v-model="newComment.content" id="comment-content" placeholder="添加评论..." rows="4" required></textarea>
      <button type="submit" class="comment-submit">发表评论</button>
    </form>
  </div>
</template>
  
<style scoped>
.comments-section {
  margin-top: 30px;
}

.comment {
  border-bottom: 1px solid #ccc;
  padding: 10px 0;
}

.comment-title {
  font-size: 1rem;
  font-weight: bold;
  color: #5e5e5e;
}

.comment-form {
  padding-top: 12px;
  color: #5e5e5e;
}

.comment-form input {
  border: 1px solid #e5e5e5;
  padding: 4px 4px;
  border-radius: 3px;
}

.comment-form textarea {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
} 

.comment-submit {
  display: block;
  background-color: rgba(210,86,86,0.8);
  color: #fff;
  border: none;
  cursor: pointer;
  margin: 10px auto 0;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 0.9rem;
}

.comment-submit:hover {
  background-color: #d25656;
}

.comment-item {
  border: 1px solid #fff;
  border-radius: 8px;
  background-color: rgba(0,0,0,0.03);
  padding: 10px 15px 10px;
  font-size: 0.85rem;
  margin: 10px 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.comment-content {
  border-bottom: 1px dashed #fff;
  align-items: flex-end;
  text-indent: 2em;
}

/* 修改折叠样式 */
.comm-text-collapsed {
  overflow: hidden;
  position: relative;
  padding-right: 0;
  cursor: pointer;
  margin-top: 5px;
}

.comm-text-expanded {
  overflow: visible;
  padding-right: 0;
  cursor: default;
}

/* 展开按钮样式 */
.expand-btn {
  background: none;
  border: none;
  color: var(--color-blue);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0 2px;
  margin-left: 2px;
  display: inline;
}

.expand-btn:hover {
  color: var(--color-blue-hover, #2980b9);
}

/* 收起按钮样式 */
.collapse-btn {
  background: none;
  border: none;
  color: var(--color-blue);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0 2px;
  margin-left: 2px;
  display: inline;
}

.collapse-btn:hover {
  color: var(--color-blue-hover, #2980b9);
}

.comm-text, .reply-content {
  text-indent: 2em;
  padding: 0px 0 0 0;
}

.comm-name, .comm-time, .reply-link {
  color: #9da09e;
}

.comm-time {
  font-size: 0.8rem;
}

.op {
  font-size: 0.8rem;
  padding: 0;
  text-align: right;
}

.reply-link,.delete-link {
  font-size: 0.8rem;
  padding: 0 6px 0 0;
}

.comm-name span {
  color: var(--color-blue)
}

/* 回复部分样式 */
.replies-section {
  margin-top: 8px;
  padding-left: 1em;
}

.replies-title {
  font-size: 0.95em;
  color: #888;
}

.replies-list {
  border-radius: 5px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.reply-item {
  background: #f7f7f7;
  border-radius: 4px;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
  color: #999;
}

.reply-author {
  font-weight: bold;
  color: var(--color-blue);
}

.reply-content-collapsed {
  max-height: 4.5em;
  overflow: hidden;
  position: relative;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
}

.reply-content-expanded {
  max-height: none;
  overflow: visible;
  -webkit-line-clamp: unset;
  line-clamp: unset;
}

/* 回复表单样式 */
.reply-form {
  margin-top: 10px;
  padding: 10px;
  background-color: #f8f8f8;
  border-radius: 6px;
}

.reply-form h4 {
  margin: 0 0 8px 0;
  font-size: 0.9rem;
  color: #666;
}

.reply-form form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reply-form input {
  padding: 4px 4px;
}

.reply-form input,
.reply-form textarea {
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 0.9rem;
}

.reply-form textarea {
  resize: vertical;
  min-height: 60px;
}

.reply-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.reply-submit {
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 2px 7px;
  cursor: pointer;
  font-size: 0.85rem;
}

.reply-submit:hover {
  background-color: var(--color-blue-hover, #2980b9);
}

.reply-cancel {
  background-color: #999;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 2px 7px 3px;
  cursor: pointer;
  font-size: 0.85rem;
}

.reply-cancel:hover {
  background-color: #777;
}

.reply-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
  color: #999;
  margin-bottom: 4px;
}

.reply-author {
  font-weight: bold;
  color: var(--color-blue);
}

.reply-time {
  font-size: 0.8em;
}

.reply-content {
  color: #333;
  line-height: 1.4;
}

.reply-op {
  text-align: right;
  font-size: 0.8rem;
}

/* 嵌套回复表单样式 */
.nested-reply-form {
  margin-top: 8px;
  padding: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  border-left: 2px solid var(--color-blue);
}

.nested-reply-form h5 {
  margin: 0 0 6px 0;
  font-size: 0.85rem;
  color: #666;
}

.nested-reply-form form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nested-reply-form input,
.nested-reply-form textarea {
  border: 1px solid #e5e5e5;
  border-radius: 3px;
  padding: 4px 6px;
  font-size: 0.85rem;
}

.nested-reply-form textarea {
  resize: vertical;
  min-height: 40px;
}

.nested-reply-form .reply-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.nested-reply-form .reply-submit {
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 0.8rem;
}

.nested-reply-form .reply-cancel {
  background-color: #999;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 0.8rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>