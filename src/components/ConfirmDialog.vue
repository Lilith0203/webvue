<!-- components/ConfirmDialog.vue -->
<template>
    <Transition name="fade">
      <div v-if="visible" class="confirm-overlay">
        <div class="confirm-dialog">
          <div class="confirm-content">
            <div class="confirm-title">{{ title }}</div>
            <div class="confirm-message">{{ message }}</div>
          </div>
          <div class="confirm-actions">
            <a href="#" class="confirm-btn confirm" @click.prevent="handleConfirm">{{ confirmText }}</a>
            <a href="#" class="confirm-btn cancel" @click.prevent="handleCancel">{{ cancelText }}</a>
          </div>
        </div>
      </div>
    </Transition>
  </template>
  
  <script setup>
  defineProps({
    visible: Boolean,
    title: {
      type: String,
      default: '确认'
    },
    message: String,
    confirmText: {
      type: String,
      default: '确定'
    },
    cancelText: {
      type: String,
      default: '取消'
    }
  })
  
  const emit = defineEmits(['confirm', 'cancel'])
  
  const handleConfirm = () => emit('confirm')
  const handleCancel = () => emit('cancel')
  </script>
  
  <style scoped>
  .confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 2000;
  }
  
  .confirm-dialog {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    width: 90%;
    max-width: 400px;
    padding: 20px;
    animation: slideIn 0.3s ease;
  }
  
  .confirm-title {
    font-size: 18px;
    font-weight: bold;
    color: #333;
    margin-bottom: 12px;
  }
  
  .confirm-message {
    font-size: 14px;
    color: #666;
    line-height: 1.5;
    margin-bottom: 20px;
  }
  
  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  
  .confirm-btn {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 14px;
    text-decoration: none;
    transition: all 0.3s ease;
  }
  
  .confirm-btn.confirm {
    background: var(--color-primary, #42b883);
    color: white;
  }
  
  .confirm-btn.confirm:hover {
    background: var(--color-primary-dark, #3aa876);
    transform: translateY(-1px);
  }
  
  .confirm-btn.cancel {
    background: #f5f5f5;
    color: #666;
  }
  
  .confirm-btn.cancel:hover {
    background: #e8e8e8;
    transform: translateY(-1px);
  }
  
  /* 动画 */
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s;
  }
  
  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
  
  @keyframes slideIn {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  /* 响应式调整 */
  @media (max-width: 768px) {
    .confirm-dialog {
      margin: 20px;
      padding: 16px;
    }
  
    .confirm-actions {
      flex-direction: column;
    }
  
    .confirm-btn {
      width: 100%;
      text-align: center;
    }
  }
  </style>