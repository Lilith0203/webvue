<script setup>
defineProps({
  msg: {
    type: String,
    required: true,
  },
})
</script>

<template>
  <div class="greetings">
    <h1 class="green">{{ msg }}</h1>
    <h3>
      常用链接：
      <a href="https://github.com/Lilith0203/" target="_blank" rel="noopener">Git</a>,
      <a href="https://www.iconfont.cn/" target="_blank" rel="noopener">iconfont</a> 
    </h3>
  </div>
</template>

<style scoped>
h1 {
  font-weight: 500;
  font-size: 2.4rem;
  position: relative;
  top: -10px;
}

h3 {
  font-size: 0.8rem;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

.greetings h1 {
  width: 200px;
  margin: 0 auto;
  background: url('http://lilithu.oss-cn-shanghai.aliyuncs.com/images/article-logo.png') no-repeat center center;
  background-size: 100% auto;
}

@media (min-width: 1024px) {
  .greetings h1,
  .greetings h3 {
    text-align: left;
  }
}
</style>
