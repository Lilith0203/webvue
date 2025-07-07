<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'
import axios from '../api'
import { useRouter, useRoute } from 'vue-router'
import { message } from '../utils/message'
import { confirm } from '../utils/confirm'
  
const router = useRouter()
const route = useRoute()
  
// 判断是否为编辑模式
const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const newTag = ref('')
const showPreview = ref(false)
const contentEditor = ref(null)
const imageInput = ref(null)
const isDragging = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const categories = ref(['世界之外', '时空中的绘旅人'])

// 表单数据
const guideForm = ref({
  title: '',
  tags: [],
  content: '',
  category: ''
})

// 触发文件选择
const triggerImageUpload = () => {
  imageInput.value.click()
}

// 处理文件上传
const uploadImage = async (file) => {
  if (!file || !file.type.startsWith('image/')) {
    message.alert('请选择图片文件')
    return
  }

  uploading.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('file', file);
    formData.append('folder', 'guide');

    const response = await axios.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        uploadProgress.value = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        )
      }
    })

    const imageUrl = response.data.url
    insertImageMarkdown(imageUrl)
  } catch (error) {
    console.error('上传失败:', error)
    alert('图片上传失败')
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

// 插入Markdown图片语法
const insertImageMarkdown = (imageUrl) => {
  const textarea = contentEditor.value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const content = guideForm.value.content
  
  const urlObj = new URL(imageUrl);
  const paramsToRemove = ['Expires', 'OSSAccessKeyId', 'Signature', 'security-token','x-oss-process'];
  paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
  imageUrl = urlObj.toString();
  const imageMarkdown = `![image](${imageUrl})`
  guideForm.value.content = 
    content.substring(0, start) + 
    imageMarkdown + 
    content.substring(end)
  
  setTimeout(() => {
    textarea.focus()
    const newPosition = start + imageMarkdown.length
    textarea.setSelectionRange(newPosition, newPosition)
  })
}

// 处理文件选择
const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    uploadImage(file)
  }
  event.target.value = ''
}

// 处理拖拽
const handleDragOver = (event) => {
  isDragging.value = true
  event.dataTransfer.dropEffect = 'copy'
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleDrop = (event) => {
  isDragging.value = false
  const file = event.dataTransfer.files[0]
  if (file) {
    uploadImage(file)
  }
}
  
// 获取攻略详情
const fetchGuide = async () => {
  if (!isEdit.value) return
    
  loading.value = true
  try {
    const response = await axios.get(`/guide/${route.params.id}`)
    const guide = response.data.data
      
    guideForm.value = {
      title: guide.title,
      tags: guide.tags ? guide.tags.split(',').filter(tag => tag.trim()) : [],
      content: guide.content,
      category: guide.category
    }
  } catch (error) {
    console.error('获取攻略失败:', error)
    alert('获取攻略失败')
    router.push('/guide')
  } finally {
    loading.value = false
  }
}
  
onMounted(fetchGuide)
  
// Markdown 预览
const renderedContent = computed(() => {
  return marked(guideForm.value.content)
})
  
// 添加标签
const addTag = () => {
  const tag = newTag.value.trim().replace(',', '')
  if (tag && !guideForm.value.tags.includes(tag)) {
    guideForm.value.tags.push(tag)
  }
  newTag.value = ''
}
  
// 移除标签
const removeTag = (index) => {
  guideForm.value.tags.splice(index, 1)
}
  
// 切换预览
const togglePreview = () => {
  showPreview.value = !showPreview.value
}
  
// 插入Markdown语法
const insertMarkdown = (prefix, suffix = '') => {
  const textarea = contentEditor.value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = guideForm.value.content
    
  const beforeText = text.substring(0, start)
  const selectedText = text.substring(start, end)
  const afterText = text.substring(end)
  const scrollTop = textarea.scrollTop;
  
  guideForm.value.content = beforeText + prefix + selectedText + suffix + afterText
    
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(
      start + prefix.length,
      end + prefix.length
    ),
    textarea.scrollTop = scrollTop;
  })
}

// 插入表格
const insertTable = () => {
  const textarea = contentEditor.value
  const start = textarea.selectionStart
  const text = guideForm.value.content
    
  const beforeText = text.substring(0, start)
  const afterText = text.substring(start)
  const scrollTop = textarea.scrollTop;
  
  const tableMarkdown = `| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容1 | 内容2 | 内容3 |
| 内容4 | 内容5 | 内容6 |`
  
  guideForm.value.content = beforeText + tableMarkdown + afterText
    
  setTimeout(() => {
    textarea.focus()
    const newPosition = start + tableMarkdown.length
    textarea.setSelectionRange(newPosition, newPosition)
    textarea.scrollTop = scrollTop;
  })
}
  
// 发布或更新攻略
const handleSubmit = async () => {
  try {
    if (isEdit.value) {
      await axios.put(`/guide/${route.params.id}`, guideForm.value)
      router.push(`/guide/${route.params.id}`)
    } else {
      await axios.post('/guide', guideForm.value)
      router.push('/guide')
    }
  } catch (error) {
    console.error('操作失败:', error)
    alert(isEdit.value ? '更新攻略失败' : '发布攻略失败')
  }
}
  
// 取消编辑
const cancelEdit = async() => {
  const confirmed = await confirm('确定要取消编辑吗？未保存的修改将丢失')
  if (confirmed) {
    router.back()
  }
}
  
// 离开页面前确认
const beforeUnload = (e) => {
  e.preventDefault()
  e.returnValue = ''
}
  
onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
})
  
onUnmounted(() => {
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<template>
  <div class="publish-guide">
    <h2>{{ isEdit ? '编辑攻略' : '发布攻略' }}</h2>
      
    <div v-if="loading" class="loading">加载中...</div>
      
    <form v-else @submit.prevent="handleSubmit" class="guide-form">
      <div class="form-group">
        <label for="title">标题</label>
        <input 
          type="text" 
          id="title"
          v-model="guideForm.title"
          required
          placeholder="请输入攻略标题">
      </div>

      <div class="form-group">
        <label for="category">分类</label>
        <select 
          id="category"
          v-model="guideForm.category"
          required>
          <option value="">请选择分类</option>
          <option v-for="category in categories" :key="category" :value="category">
            {{ category }}
          </option>
        </select>
      </div>
  
      <div class="form-group">
        <label>标签</label>
        <div class="tags-input">
          <div class="tags-container">
            <span 
              v-for="(tag, index) in guideForm.tags" 
              :key="index"
              class="tag">
              {{ tag }}
              <button 
                type="button" 
                @click.prevent="removeTag(index)"
                >&times;
              </button>
            </span>
          </div>
          <div class="tag-input-wrapper">
            <input 
              type="text"
              v-model="newTag"
              @keydown.enter.prevent="addTag"
              @keydown.comma.prevent="addTag"
              placeholder="输入标签，按Enter或逗号添加"
              maxlength="20">
          </div>
        </div>
      </div>
  
      <div class="form-group">
        <label for="content">内容</label>
        <div class="editor-toolbar">
          <button type="button" @click="insertMarkdown('**', '**')">粗体</button>
          <button type="button" @click="insertMarkdown('*', '*')">斜体</button>
          <button type="button" @click="insertMarkdown('### ')">标题</button>
          <button type="button" @click="insertMarkdown('> ')">引用</button>
          <button type="button" @click="insertMarkdown('- ')">列表</button>
          <button type="button" @click="insertMarkdown('[]() ')">链接</button>
          <button type="button" @click="insertMarkdown('```\n', '\n```')">代码块</button>
          <button type="button" @click="insertTable()">表格</button>
          <button type="button" @click="triggerImageUpload">插入图片</button>
          <input 
            type="file"
            ref="imageInput"
            @change="handleImageUpload"
            accept="image/*"
            style="display: none">
        </div>

        <div 
          class="editor-container"
          @drop.prevent="handleDrop"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          :class="{ 'drag-over': isDragging }">
          <textarea 
            id="content"
            v-model="guideForm.content"
            rows="20"
            required
            placeholder="请输入攻略内容（支持Markdown）"
            ref="contentEditor"></textarea>

          <div v-if="uploading" class="upload-progress">
            <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
            <span>上传中... {{ uploadProgress }}%</span>
          </div>
        </div>
        <div v-if="showPreview" class="markdown-preview" v-html="renderedContent"></div>
      </div>
  
      <div class="form-actions">
        <button type="button" @click="togglePreview" class="preview-btn">
          {{ showPreview ? '关闭预览' : '预览' }}
        </button>
        <button type="submit" class="publish-btn">
          {{ isEdit ? '保存修改' : '发布攻略' }}
        </button>
        <button 
          v-if="isEdit" 
          type="button" 
          @click="cancelEdit" 
          class="cancel-btn">
          取消编辑
        </button>
      </div>
    </form>
  </div>
</template>
  
<style scoped>
.publish-guide {
  max-width: 800px;
  margin: 30px auto;
  padding: 20px;
}

.publish-guide h2 {
  font-weight: bold;
  margin-bottom: 20px;
  font-size: 1.1rem;
}

.guide-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-weight: bold;
  color: #333;
}

input[type="text"],
textarea,
select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

select {
  background-color: white;
}

textarea {
  width: 100%;
  min-height: 300px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
}

textarea:focus,
input:focus,
select:focus {
  outline: none;
  border-color: #007bff;
}

.tags-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  background-color: #e0e0e0;
  border-radius: 4px;
  font-size: 14px;
}

.tag button {
  border: none;
  background: none;
  color: #666;
  cursor: pointer;
  padding: 0 4px;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 8px;
}

.editor-toolbar button {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
}

.markdown-preview {
  margin-top: 10px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
}

:deep(.markdown-preview p) {
  text-indent: 2em;
  line-height: 1.8em;
  margin-bottom: 6px;
  text-align: left;
}

:deep(.markdown-preview h3) {
  line-height: 2;
  margin-top: 10px;
  font-weight: bold;
  text-align: left;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.preview-btn,
.publish-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.preview-btn {
  background-color: #f0f0f0;
  color: #333;
}

.publish-btn {
  background-color: #007bff;
  color: white;
}

.publish-btn:hover {
  background-color: #0056b3;
}

.loading {
  text-align: center;
  padding: 20px;
  color: #666;
}
  
.cancel-btn {
  padding: 8px 16px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
  
.cancel-btn:hover {
  background-color: #c82333;
}
  
.editor-container {
  position: relative;
  border: 2px dashed transparent;
  transition: border-color 0.3s;
}

.editor-container.drag-over {
  border-color: #007bff;
}

.upload-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  padding: 0 10px;
}

.progress-bar {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #007bff;
  opacity: 0.2;
  transition: width 0.3s;
}

@media (max-width: 768px) {
  .publish-guide {
    padding: 10px;
  }

  .editor-toolbar {
    flex-wrap: wrap;
  }
}
</style> 