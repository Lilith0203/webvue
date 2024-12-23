// utils/message.js
import { createApp } from 'vue'
import MessageBox from '../components/MessageBox.vue'

export const message = {
  show({ title, message, type = 'info', showCancel = false }) {
    return new Promise((resolve, reject) => {
      const mountNode = document.createElement('div')
      document.body.appendChild(mountNode)

      const messageApp = createApp(MessageBox, {
        visible: true,
        title,
        message,
        type,
        showCancel,
        onConfirm: () => {
          messageApp.unmount()
          document.body.removeChild(mountNode)
          resolve(true)
        },
        onCancel: () => {
          messageApp.unmount()
          document.body.removeChild(mountNode)
          resolve(false)
        }
      })

      messageApp.mount(mountNode)
    })
  },

  alert(message, title = '提示') {
    return this.show({ title, message })
  },

  confirm(message, title = '确认') {
    return this.show({ title, message, showCancel: true })
  },

  success(message, title = '成功') {
    return this.show({ title, message, type: 'success' })
  },

  warning(message, title = '警告') {
    return this.show({ title, message, type: 'warning' })
  },

  error(message, title = '错误') {
    return this.show({ title, message, type: 'error' })
  }
}