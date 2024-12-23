// utils/confirm.js
import { createApp } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

export const confirm = (message, title = '确认') => {
  return new Promise((resolve) => {
    const mountNode = document.createElement('div')
    document.body.appendChild(mountNode)

    const app = createApp(ConfirmDialog, {
      visible: true,
      title,
      message,
      onConfirm: () => {
        app.unmount()
        document.body.removeChild(mountNode)
        resolve(true)
      },
      onCancel: () => {
        app.unmount()
        document.body.removeChild(mountNode)
        resolve(false)
      }
    })

    app.mount(mountNode)
  })
}