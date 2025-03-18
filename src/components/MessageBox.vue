<!-- components/MessageBox.vue -->
<script setup>
const props = defineProps({
  visible: Boolean,
  title: String,
  message: String,
  type: {
    type: String,
    default: 'info' // info, success, warning, error
  },
  confirmText: {
    type: String,
    default: '确定'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  showCancel: {
    type: Boolean,
    default: false
  }
})
  
const emit = defineEmits(['confirm', 'cancel'])
  
const confirm = () => emit('confirm')
const cancel = () => emit('cancel')
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="message-overlay">
      <div class="message-box" :class="type">
        <div class="message-content">
          <div class="message-title" v-if="title">{{ title }}</div>
          <div class="message-text">{{ message }}</div>
        </div>
        <div class="message-actions">
          <a href="#" class="btn confirm" @click.prevent="confirm">{{ confirmText }}</a>
          <a v-if="showCancel" href="#" class="btn cancel" @click.prevent="cancel">{{ cancelText }}</a>
        </div>
      </div>
    </div>
  </Transition>
</template>
  
<style scoped>
.message-overlay {
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
  
.message-box {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 420px;
  padding: 20px;
}
  
.message-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #333;
}
  
.message-text {
  font-size: 14px;
  line-height: 1.5;
  color: #666;
  margin-bottom: 20px;
}
  
.message-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
  
.btn {
  padding: 3px 8px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 14px;
  transition: all 0.3s ease;
}
  
.confirm {
  background: var(--color-primary, #42b883);
  color: white;
}
  
.confirm:hover {
  background: var(--color-primary-dark, #3aa876);
}
  
.cancel {
  background: #f5f5f5;
  color: #666;
}
  
.cancel:hover {
  background: #e8e8e8;
}
  
/* 消息类型样式 */
.message-box.success .message-title {
  color: #67c23a;
}
  
.message-box.warning .message-title {
  color: #e6a23c;
}
  
.message-box.error .message-title {
  color: #f56c6c;
}
  
/* 动画效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
  
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>