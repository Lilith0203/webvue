<!-- components/SetEditor.vue -->
<script setup>
import { ref, reactive, computed } from 'vue'
import axios from '../api'
import { message } from '../utils/message'

const props = defineProps({
  visible: Boolean,
  set: {
    type: Object,
    default: () => ({
      id: null,
      name: '',
      description: '',
      cover: '',
      tags: []
    })
  },
  mode: {
    type: String,
    default: 'create' // 'create' 或 'edit'
  }
})

const emit = defineEmits(['cancel', 'success'])

const submitting = ref(false)
const newTag = ref('')

const initFormData = () => {
  return {
    id: props.set?.id || null,
    name: props.set?.name || '',
    description: props.set?.description || '',
    cover: props.set?.cover || '',
    tags: [...(props.set?.tags || [])]
  }
}

const formData = reactive(initFormData())

// 图片上传
const handleImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    message.alert('请选择图片文件')
    return
  }

  try {
    const upload = new FormData()
    upload.append('file', file)
    upload.append('folder', 'works')
    
    const response = await axios.post('/upload', upload, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    
    // 解析 URL
    const urlObj = new URL(response.data.url)
    // 移除签名相关参数
    const paramsToRemove = ['Expires', 'OSSAccessKeyId', 'Signature', 'security-token', 'x-oss-process']
    paramsToRemove.forEach(param => urlObj.searchParams.delete(param))
    
    formData.cover = urlObj.toString()
    message.success('上传成功')
  } catch (error) {
    console.error('上传失败:', error)
    message.alert('上传失败')
  }
  
  // 清空input，以便可以重复选择同一文件
  event.target.value = ''
}

// 添加标签
const addTag = (event) => {
  if (event) {
    event.preventDefault()
    event.stopPropagation()
  }
  if (newTag.value.trim() && !formData.tags.includes(newTag.value.trim())) {
    formData.tags.push(newTag.value.trim())
    newTag.value = ''
  }
}

// 删除标签
const removeTag = (tag) => {
  const index = formData.tags.indexOf(tag)
  if (index > -1) {
    formData.tags.splice(index, 1)
  }
}

// 提交表单
const handleSubmit = async () => {
  if (submitting.value) return
  
  if (!formData.name.trim()) {
    message.alert('请输入合集名称')
    return
  }
  
  submitting.value = true
  try {
    const url = props.mode === 'create' ? '/works-set/add' : '/works-set/edit'
    
    const submitData = {
      ...formData,
      id: props.mode === 'create' ? null : formData.id,
      tags: formData.tags || [],
      cover: formData.cover || ''
    }
    
    const response = await axios.post(url, submitData)
    message.success(props.mode === 'create' ? '创建成功' : '更新成功')
    emit('success')
  } catch (error) {
    console.error('保存失败:', error)
    message.error(error.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  Object.assign(formData, initFormData())
  newTag.value = ''
}
</script>

<template>
  <Transition name="fade">
    <div class="set-editor-overlay" v-if="visible" @click.self="emit('cancel')">
      <div class="set-editor">
        <div class="editor-header">
          <h3>{{ mode === 'create' ? '创建合集' : '编辑合集' }}</h3>
          <button class="close-btn" @click="emit('cancel')">
            <i class="iconfont icon-guanbi"></i>
          </button>
        </div>
        
        <form @submit.prevent="handleSubmit">
          <div class="form-item">
            <label>名称 <span class="required">*</span></label>
            <input v-model="formData.name" required placeholder="请输入合集名称">
          </div>

          <div class="form-item">
            <label>描述</label>
            <textarea 
              v-model="formData.description" 
              rows="6"
              placeholder="请输入合集描述"
            ></textarea>
          </div>

          <div class="form-item">
            <label>封面</label>
            <div class="cover-upload">
              <div v-if="formData.cover" class="cover-preview">
                <img :src="formData.cover" alt="封面预览">
                <button type="button" class="remove-cover" @click="formData.cover = ''">
                  <i class="iconfont icon-shanchu"></i>
                </button>
              </div>
              <label v-else class="upload-label">
                <input type="file" accept="image/*" @change="handleImageUpload" style="display: none">
                <span>上传封面</span>
              </label>
            </div>
          </div>

          <div class="form-item">
            <label>标签</label>
            <div class="tags-input">
              <input 
                v-model="newTag" 
                type="text"
                @keydown.enter.prevent="addTag"
                @keyup.enter.prevent="addTag"
                placeholder="输入标签后按回车添加"
              >
            </div>
            <div v-if="formData.tags.length > 0" class="tags-list">
              <span 
                v-for="tag in formData.tags" 
                :key="tag" 
                class="tag-item"
              >
                {{ tag }}
                <span class="tag-remove" @click="removeTag(tag)">×</span>
              </span>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" @click="emit('cancel')" class="cancel-btn">取消</button>
            <button type="submit" :disabled="submitting" class="submit-btn">
              {{ submitting ? '保存中...' : (mode === 'create' ? '创建' : '更新') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.set-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.set-editor {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
}

.editor-header h3 {
  margin: 0;
  font-size: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

form {
  padding: 0 20px 20px 20px;
}

.form-item {
  margin-bottom: 10px;
}

.form-item label {
  font-size: 0.9rem;
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.required {
  color: #e53935;
}

.form-item input,
.form-item textarea {
  width: 100%;
  padding: 7px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-item textarea {
  resize: vertical;
  font-family: inherit;
}

.cover-upload {
  margin-top: 8px;
}

.cover-preview {
  position: relative;
  display: inline-block;
  max-width: 200px;
}

.cover-preview img {
  width: 100%;
  max-width: 200px;
  height: auto;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.remove-cover {
  position: absolute;
  top: -10px;
  right: -10px;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.upload-label {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border: 2px dashed #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  color: #999;
  text-align: center;
}

.upload-label:hover {
  border-color: var(--color-blue);
  color: var(--color-blue);
}

.upload-label span {
  position: relative;
  top: 20%;
  text-align: center;
  font-size: 0.85rem;
  color: #999;
}

.tags-input {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.tags-input input {
  flex: 1;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  background: #f0f0f0;
  border-radius: 6px;
  font-size: 0.8rem;
}

.tag-remove {
  cursor: pointer;
  color: #999;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;
  transition: color 0.2s;
}

.tag-remove:hover {
  color: #e53935;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.cancel-btn,
.submit-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.3s;
}

.cancel-btn {
  background: #f5f5f5;
  color: #333;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.submit-btn {
  background: var(--color-blue);
  color: white;
}

.submit-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

