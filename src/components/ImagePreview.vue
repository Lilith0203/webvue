<template>
    <Transition name="fade">
      <div v-if="visible" class="image-preview-popup" @click.self="close">
        <div class="preview-content">
          <img v-image="imageUrl" :alt="title || '预览图片'">
          <div class="preview-title" v-if="title">{{ title }}</div>
          <button class="close-btn" @click="close">&times;</button>
        </div>
      </div>
    </Transition>
  </template>
  
  <script setup>
  defineProps({
    visible: Boolean,
    imageUrl: String,
    title: String
  })
  
  const emit = defineEmits(['close'])
  
  const close = () => {
    emit('close')
  }
  </script>
  
  <style scoped>
  .image-preview-popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .preview-content {
    position: relative;
    background: white;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    max-width: 90vw;
    max-height: 90vh;
  }
  
  .preview-content img {
    max-width: 100%;
    max-height: calc(90vh - 60px);
    object-fit: contain;
  }
  
  .preview-title {
    text-align: center;
    padding: 10px;
    color: #333;
    font-size: 14px;
  }
  
  .close-btn {
    position: absolute;
    top: -40px;
    right: -40px;
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 10px;
  }
  
  .fade-enter-active,
  .fade-leave-active {
    transition: all 0.3s ease;
  }
  
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
    transform: scale(0.9);
  }

  @media (min-width: 1024px) {
    .preview-content img {
      max-width: 600px;
    }
  }
  </style>