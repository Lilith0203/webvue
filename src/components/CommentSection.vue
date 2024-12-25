<script setup>
  import { ref,defineProps } from 'vue'
  
  const props = defineProps({
    comments: {
      type: Array,
      default: () => []
    },
    onCommentSubmit: {
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
      alert('请填写姓名和评论内容')
      return
    }
    const commentData = {
      name: newComment.value.name,
      content: newComment.value.content,
      reply: 0  // 初始化回复数组
    }
    // 调用父组件的提交评论方法
    props.onCommentSubmit(commentData)
    // 清空输入框
    newComment.value.name = ''
    newComment.value.content = ''
  }
  </script>

<template>
    <div class="comments-section">
      <h3 class="comment-title">最新评论.</h3>
      <div class="comments-list">
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <p class="comm-name">{{ comment.name }}</p>
          <p class="comm-text">{{ comment.text }}</p>
          <p>发表于: {{ new Date(comment.createdAt).toLocaleString() }}</p>
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
    margin-top: 20px;
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
  }

  .comment-submit:hover {
    background-color: #d25656;
  }
  </style>