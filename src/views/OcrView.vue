<script setup>
import { computed, ref } from 'vue'
import api from '../api'

const file = ref(null)
const previewUrl = ref('')

const uploading = ref(false)
const uploadProgress = ref(0)
const recognizing = ref(false)

const ocrType = ref('General') // General / Advanced / HandWriting / Table / IdCard ...

const resultText = ref('')
const errorMessage = ref('')

const canRun = computed(() => !!file.value && !uploading.value && !recognizing.value)

const onPickFile = (e) => {
  errorMessage.value = ''
  resultText.value = ''
  const f = e.target.files?.[0]
  if (!f) return
  if (!f.type?.startsWith('image/')) {
    errorMessage.value = '请选择图片文件'
    return
  }
  if (f.size > 8 * 1024 * 1024) {
    errorMessage.value = '图片大小不能超过 8MB'
    return
  }
  file.value = f
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(f)
}

const clearFile = () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = null
  previewUrl.value = ''
  uploadProgress.value = 0
  resultText.value = ''
  errorMessage.value = ''
}

const copyText = async () => {
  if (!resultText.value) return
  try {
    await navigator.clipboard.writeText(resultText.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = resultText.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

const runOcr = async () => {
  if (!file.value) return
  errorMessage.value = ''
  resultText.value = ''

  let imageUrl = ''

  uploading.value = true
  uploadProgress.value = 0
  try {
    const formData = new FormData()
    formData.append('file', file.value)
    formData.append('folder', 'tools/ocr')
    const uploadRes = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (!progressEvent.total) return
        uploadProgress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
      }
    })
    imageUrl = uploadRes?.data?.url || ''
    if (!imageUrl) throw new Error('上传失败：未返回 url')
  } catch (err) {
    errorMessage.value = err?.response?.data?.message || err?.message || '上传失败'
    return
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }

  recognizing.value = true
  try {
    const ocrRes = await api.post('/ocr', { url: imageUrl, type: ocrType.value })
    if (!ocrRes?.data?.success) throw new Error(ocrRes?.data?.message || 'OCR 识别失败')
    resultText.value = ocrRes?.data?.text || ''
    if (!resultText.value) {
      errorMessage.value = '识别成功，但未提取到文字（可尝试切换类型为 Advanced 或 HandWriting）'
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.message || err?.message || 'OCR 识别失败'
  } finally {
    recognizing.value = false
  }
}
</script>

<template>
  <div class="ocr-page">
    <h2 class="title">文字识别（OCR）</h2>

    <div class="panel">
      <div class="left">
        <label class="file-picker">
          <input type="file" accept="image/*" @change="onPickFile" />
          <span>选择图片</span>
        </label>

        <div class="type-row">
          <span class="type-label">类型</span>
          <select v-model="ocrType" class="type-select">
            <option value="General">General（通用基础版）</option>
            <option value="Advanced">Advanced（通用高精版）</option>
            <option value="HandWriting">HandWriting（手写）</option>
            <option value="Table">Table（表格）</option>
            <option value="IdCard">IdCard（身份证）</option>
            <option value="MultiLang">MultiLang（多语言）</option>
          </select>
        </div>

        <div v-if="previewUrl" class="preview">
          <img :src="previewUrl" alt="preview" />
        </div>
        <div v-else class="placeholder">
          <span>暂无图片预览</span>
        </div>

        <div class="actions">
          <button class="btn primary" :disabled="!canRun" @click="runOcr">
            {{ recognizing || uploading ? '处理中...' : '开始识别' }}
          </button>
          <button class="btn" :disabled="uploading || recognizing" @click="clearFile">清空</button>
        </div>

        <div v-if="uploading" class="progress">上传中：{{ uploadProgress }}%</div>
      </div>

      <div class="right">
        <div class="result-head">
          <h3>识别结果</h3>
          <button class="btn small" :disabled="!resultText" @click="copyText">复制</button>
        </div>

        <textarea
          class="result-text"
          v-model="resultText"
          placeholder="识别结果会显示在这里"
          rows="16"
        />

        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ocr-page {
  margin-top: 15px;
}
.title {
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 6px;
}
.sub-title {
  color: #666;
  margin-bottom: 12px;
}
.panel {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 14px;
  align-items: start;
}
.left,
.right {
  border: 1px dashed #dfdfdf;
  border-radius: 6px;
  padding: 12px;
  background: #fff;
}
.file-picker input {
  display: none;
}
.file-picker span {
  display: inline-block;
  padding: 4px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  background: #fafafa;
  font-size: 0.85rem;
}
.type-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.type-label {
  color: #666;
  font-size: 13px;
}
.type-select {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 6px 10px;
  background: #fff;
}
.preview,
.placeholder {
  margin-top: 12px;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
  height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}
.preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}
.btn {
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}
.btn.primary {
  background: var(--color-blue);
  color: #fff;
  border-color: transparent;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn.small {
  padding: 6px 10px;
  font-size: 12px;
}
.progress {
  margin-top: 10px;
  color: #666;
  font-size: 12px;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.result-head h3 {
  margin: 0;
  font-size: 1rem;
}
.result-text {
  width: 100%;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 10px;
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}
.error {
  margin-top: 10px;
  color: #d55355;
}

@media (max-width: 900px) {
  .panel {
    grid-template-columns: 1fr;
  }
}
</style>

