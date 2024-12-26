<template>
  <div class="about">
    <h1>关于本站</h1>
    <p>作者是一个什么都会一点什么都不精通的混日子程序员。</p>
    <p>平时还会做点小手工，因此有了些东西需要整理收集，</p>
    <p>所以就有了这个网站。</p>
    <p>图片、笔记和一些杂七杂八的东西都会往这里放。</p>
    <p>bilibili 会有我的一些游戏剧情剪辑视频。</p>
    <p>小红书主要分享手工（还在整理中，旧的手工视频还在b站上）。</p>
  </div>
</template>

<style>
.about {
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    margin: 20px 0;
    text-align: center;
  }

  h1 {
    font-size: 1.4rem;
    margin-bottom: 1rem;
  }

  .about p {
    margin-bottom: 5px;
  }

@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    margin: 0;
  }
}
</style>
