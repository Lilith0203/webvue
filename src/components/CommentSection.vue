<script setup>
import { ref,defineProps } from 'vue'
import { useAuthStore } from '../stores/auth'
import { message } from '../utils/message'
import { isValidComment } from '../utils/validation'

const authStore = useAuthStore()
const lastCommentTime = ref(0);
const commentCooldown = 10000; // 10秒冷却时间
  
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
  
// 提交评论
const submitComment = () => {
  if (!newComment.value.name || !newComment.value.content) {
    message.alert('请填写姓名和评论内容')
    return
  }
  //return;
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
  // 清空输入框
  newComment.value.name = ''
  newComment.value.content = ''
}

const commentDelete = async(commentId) => {
  props.onCommentDelete(commentId)
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
          <div class="comm-text">{{ comment.content }}</div>
          <div class="op">
            <a href="#" class="reply-link">回复</a>
            <a v-if="authStore.isAuthenticated" 
              href="#" class="delete-link"
              @click.prevent="commentDelete(comment.id)">删除</a>
          </div>
        </div>
        <!-- 如果有回复，可以在这里递归显示 -->
        <div v-if="comment.replies && comment.replies.length">
          <h4>回复:</h4>
          <ul>
            <li v-for="reply in comment.replies" :key="reply.id">
              <p><strong>{{ reply.name }}</strong>: {{ reply.content }}</p>
              <p>发表于: {{ new Date(reply.createdAt).toLocaleString() }}</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <form class="comment-form" @submit.prevent="submitComment">
      <label for="revname">Name：</label>
      <input v-model="newComment.name" type="text" placeholder="昵称请不要多于10个字" required>
      <textarea v-model="newComment.content" placeholder="添加评论..." rows="4" required></textarea>
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
  padding: 5px 6px;
  font-size: 0.9rem;
}

.comment-submit:hover {
  background-color: #d25656;
}

.comment-item {
  border-radius: 5px;
  background-color: rgba(0,0,0,0.03);
  padding: 10px 20px;
  font-size: 0.9rem;
  margin: 10px 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.comment-content {
  align-items: flex-end;
}

.comm-text {
  text-indent: 2em;
  padding: 4px 0 0 0;
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
</style>