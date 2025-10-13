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
// 表单数据
const articleForm = ref({
  title: '',
  tags: [],
  abbr: '',
  content: ''
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
    // 创建 FormData
    const formData = new FormData()
    formData.append('file', file);
    formData.append('folder', 'article');

    // 发送上传请求
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

    // 获取图片URL
    const imageUrl = response.data.url

    // 在光标位置插入Markdown图片语法
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
  const content = articleForm.value.content
  
  // 解析 URL
  const urlObj = new URL(imageUrl);
  // 移除签名相关参数
  const paramsToRemove = ['Expires', 'OSSAccessKeyId', 'Signature', 'security-token','x-oss-process'];
  paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
  imageUrl = urlObj.toString();
  const imageMarkdown = `![image](${imageUrl})`
  articleForm.value.content = 
    content.substring(0, start) + 
    imageMarkdown + 
    content.substring(end)
  
  // 设置光标位置
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
  // 清除选择，允许重复选择同一文件
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
  
// 获取文章详情
const fetchArticle = async () => {
  if (!isEdit.value) return
    
  loading.value = true
  try {
    const response = await axios.get(`/article/${route.params.id}`)
    const article = response.data.article
      
    // 填充表单数据
    articleForm.value = {
      title: article.title,
      tags: article.tags || [],
      abbr: article.abbr || '',
      content: article.content
    }
  } catch (error) {
    console.error('获取文章失败:', error)
    alert('获取文章失败')
    router.push('/article')
  } finally {
    loading.value = false
  }
}
  
// 在组件挂载时获取文章数据
onMounted(fetchArticle)
  
// Markdown 预览
const renderedContent = computed(() => {
  if (!articleForm.value.content) return ''
  // 转义星号，防止被Markdown解析为斜体
  const escapedContent = articleForm.value.content.replace(/\*/g, '\\*')
  return marked(escapedContent)
})
  
// 添加标签
const addTag = () => {
  const tag = newTag.value.trim().replace(',', '')
  if (tag && !articleForm.value.tags.includes(tag)) {
    articleForm.value.tags.push(tag)
  }
  newTag.value = ''
}
  
// 移除标签
const removeTag = (index) => {
  articleForm.value.tags.splice(index, 1)
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
  const text = articleForm.value.content
    
  const beforeText = text.substring(0, start)
  const selectedText = text.substring(start, end)
  const afterText = text.substring(end)
  // 记录插入前的滚动位置
  const scrollTop = textarea.scrollTop;
  
  articleForm.value.content = beforeText + prefix + selectedText + suffix + afterText
    
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(
      start + prefix.length,
      end + prefix.length
    ),
    // 恢复滚动位置
    textarea.scrollTop = scrollTop;
  })
}
  
// 发布或更新文章
const handleSubmit = async () => {
  try {
    if (isEdit.value) {
      articleForm.value.id = route.params.id
      await axios.post(`/article/edit`, articleForm.value)
      //message.alert('文章更新成功')
      router.push(`/article/${route.params.id}`)
    } else {
      await axios.post('/articleAdd', articleForm.value)
      //alert('文章发布成功')
      router.push('/article')
    }
  } catch (error) {
    console.error('操作失败:', error)
    alert(isEdit.value ? '更新文章失败' : '发布文章失败')
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
  <div class="publish-article">
    <h2>{{ isEdit ? '编辑文章' : '发布文章' }}</h2>
      
    <!-- 加载状态 -->
    <div v-if="loading" class="loading">加载中...</div>
      
    <!-- 文章表单 -->
    <form v-else @submit.prevent="handleSubmit" class="article-form">
      <!-- 标题 -->
      <div class="form-group">
        <label for="title">标题</label>
        <input 
          type="text" 
          id="title"
          v-model="articleForm.title"
          required
          placeholder="请输入文章标题">
      </div>
  
      <!-- 标签 -->
      <div class="form-group">
        <label>标签</label>
        <div class="tags-input">
          <div class="tags-container">
            <span 
              v-for="(tag, index) in articleForm.tags" 
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
          <!-- 修改标签输入框，添加 @keydown.enter.prevent -->
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
  
      <!-- 内容 -->
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

          <button type="button" @click="triggerImageUpload">插入图片</button>
          <input 
            type="file"
            ref="imageInput"
            @change="handleImageUpload"
            accept="image/*"
            style="display: none">
        </div>

        <!-- 添加拖拽上传区域 -->
        <div 
          class="editor-container"
          @drop.prevent="handleDrop"
          @dragover.prevent="handleDragOver"
          @dragleave.prevent="handleDragLeave"
          :class="{ 'drag-over': isDragging }">
          <textarea 
            id="content"
            v-model="articleForm.content"
            rows="20"
            required
            placeholder="请输入文章内容（支持Markdown）"
            ref="contentEditor"></textarea>

          <!-- 上传进度提示 -->
          <div v-if="uploading" class="upload-progress">
            <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
            <span>上传中... {{ uploadProgress }}%</span>
          </div>
        </div>
        <!-- 预览区域 -->
        <div v-if="showPreview" class="markdown-preview" v-html="renderedContent"></div>
      </div>

      <!-- 摘要 -->
      <div class="form-group">
        <label for="abbr">摘要</label>
        <textarea 
          id="abbr"
          v-model="articleForm.abbr"
          rows="3"
          placeholder="请输入文章摘要"
          ></textarea>
      </div>
  
      <!-- 控制按钮 -->
      <div class="form-actions">
        <button type="button" @click="togglePreview" class="preview-btn">
          {{ showPreview ? '关闭预览' : '预览' }}
        </button>
        <button type="submit" class="publish-btn">
          {{ isEdit ? '保存修改' : '发布文章' }}
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
.publish-article {
  max-width: 800px;
  margin: 30px auto;
  padding: 20px;
}

.publish-article h2 {
  font-weight: bold;
  margin-bottom: 20px;
  font-size: 1.1rem;
}

.article-form {
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
textarea {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
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

textarea#abbr {
  min-height: 100px;
} 

textarea:focus {
  outline: none;
  border-color: #42b883;
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
.draft-btn,
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

.draft-btn {
  background-color: #e0e0e0;
  color: #333;
}

.publish-btn {
  background-color: #42b883;
  color: white;
}

.publish-btn:hover {
  background-color: #3aa876;
}

/* 添加新样式 */
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
  
/* 编辑模式下的特殊样式 */
.publish-article.edit-mode {
  background-color: #fff;
}
  
/* 未保存提示 */
.unsaved-warning {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #ffc107;
  color: #000;
  padding: 10px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* 编辑器容器样式 */
.editor-container {
  position: relative;
  border: 2px dashed transparent;
  transition: border-color 0.3s;
}

.editor-container.drag-over {
  border-color: #42b883;
}

/* 上传进度条样式 */
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
  background: #42b883;
  opacity: 0.2;
  transition: width 0.3s;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .publish-article {
    padding: 10px;
  }

  .editor-toolbar {
    flex-wrap: wrap;
  }
}
</style>