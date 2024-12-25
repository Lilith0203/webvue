<template>
    <div class="comments-section">
      <h3 class="comment-title">最新评论.</h3>
      <div v-for="comment in comments" :key="comment.id" class="comment">
        <p class="comm-name">{{ comment.name }}</p>
        <p class="comm-text">{{ comment.text }}</p>
      </div>
      <form class="comment-form">
        <label for="revname">Name：</label>
        <input id="revname" name="revname" type="text" placeholder="昵称请不要多于10个字" required>
        <textarea v-model="newComment" placeholder="添加评论..." rows="3"></textarea>
        <button @click="submitComment" class="comment-submit">发表评论</button>
      </form>
    </div>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  
  const props = defineProps({
    comments: {
      type: Array,
      required: true
    },
    onCommentSubmit: {
      type: Function,
      required: true
    }
  })
  
  const newComment = ref('')
  
  // 提交评论
  const submitComment = () => {
    if (newComment.value.trim()) {
      props.onCommentSubmit(newComment.value) // 调用父组件的提交方法
      newComment.value = '' // 清空输入框
    }
  }
  </script>
  
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