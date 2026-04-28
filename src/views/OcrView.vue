<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import api from '../api'

const files = ref([]) // File[]
const previewUrls = ref([]) // string[]
const activeIndex = ref(0)

const activeFile = computed(() => files.value[activeIndex.value] || null)
const activePreviewUrl = computed(() => previewUrls.value[activeIndex.value] || '')

const uploading = ref(false)
const uploadProgress = ref(0)
const recognizing = ref(false)
const runningIndex = ref(0)
const runningTotal = ref(0)

const ocrType = ref('General') // General / Advanced / HandWriting / Table / IdCard ...
const languages = ref('chn,eng') // MultiLang 时生效

const outputRow = ref(true) // Advanced 时生效
const outputParagraph = ref(false) // Advanced 时生效
const outputTable = ref(false) // Advanced 时生效

// 数字后处理（针对 9->99 这类误识别）
const digitsOnly = ref(false)
const normalizeDigits = ref(true)
const compressRepeats = ref(false)

// 中文标点纠错（保守策略，避免误伤真实数字 66/99）
const zhPunctFix = ref(true)

const resultText = ref('')
const errorMessage = ref('')

import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')
const ocrUserEnabled = ref(true)

const canRun = computed(() => {
  if (!isAdmin.value && !ocrUserEnabled.value) return false
  return files.value.length > 0 && !uploading.value && !recognizing.value
})

const replaceFiles = (list) => {
  errorMessage.value = ''
  resultText.value = ''
  if (!Array.isArray(list) || list.length === 0) return

  // revoke old previews
  for (const u of previewUrls.value) {
    if (u) URL.revokeObjectURL(u)
  }

  const accepted = []
  const previews = []
  for (const f of list) {
    if (!f) continue
    if (!f.type?.startsWith('image/')) continue
    if (f.size > 8 * 1024 * 1024) continue
    accepted.push(f)
    previews.push(URL.createObjectURL(f))
  }

  if (accepted.length === 0) {
    errorMessage.value = '请选择图片文件（单张不超过 8MB）'
    return
  }

  files.value = accepted
  previewUrls.value = previews
  activeIndex.value = 0
}

const onPickFile = (e) => {
  const list = Array.from(e.target.files || [])
  replaceFiles(list)
  // reset value so same file can be picked again
  e.target.value = ''
}

const addFiles = (list) => {
  if (!Array.isArray(list) || list.length === 0) return
  errorMessage.value = ''
  resultText.value = ''

  const nextFiles = [...files.value]
  const nextPreviews = [...previewUrls.value]
  for (const f of list) {
    if (!f) continue
    if (!f.type?.startsWith('image/')) continue
    if (f.size > 8 * 1024 * 1024) continue
    nextFiles.push(f)
    nextPreviews.push(URL.createObjectURL(f))
  }
  if (nextFiles.length === files.value.length) {
    errorMessage.value = '未检测到可用图片（单张不超过 8MB）'
    return
  }
  files.value = nextFiles
  previewUrls.value = nextPreviews
  if (activeIndex.value >= files.value.length) activeIndex.value = 0
}

const handlePaste = (event) => {
  const items = event?.clipboardData?.items
  if (!items || !items.length) return

  for (const item of items) {
    if (item.kind === 'file' && item.type?.startsWith('image/')) {
      const pastedFile = item.getAsFile()
      if (pastedFile) {
        event.preventDefault()
        addFiles([pastedFile])
      }
      return
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', handlePaste)
  // 加载配置：普通用户是否允许使用 OCR
  api
    .get('/config/load', { params: { keys: 'ocr_user_enabled' } })
    .then((res) => {
      const v = res?.data?.data?.ocr_user_enabled
      ocrUserEnabled.value = v !== false
      if (!isAdmin.value && !ocrUserEnabled.value) {
        errorMessage.value = '管理员已关闭普通用户文字识别功能'
      }
    })
    .catch(() => {
      ocrUserEnabled.value = true
    })
})

onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePaste)
})

const clearFile = () => {
  for (const u of previewUrls.value) {
    if (u) URL.revokeObjectURL(u)
  }
  files.value = []
  previewUrls.value = []
  activeIndex.value = 0
  uploadProgress.value = 0
  resultText.value = ''
  errorMessage.value = ''
}

const removeAt = (idx) => {
  if (idx < 0 || idx >= files.value.length) return
  const u = previewUrls.value[idx]
  if (u) URL.revokeObjectURL(u)
  files.value.splice(idx, 1)
  previewUrls.value.splice(idx, 1)
  if (activeIndex.value >= files.value.length) activeIndex.value = Math.max(0, files.value.length - 1)
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

const postProcessText = (raw) => {
  let text = raw || ''

  const isCjkOrZhPunct = (ch) => {
    if (!ch) return false
    // 汉字 + 常见中文/全角标点（含引号、省略号前后的点）
    return /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef“”‘’（）【】《》、，。！？：；…]/.test(ch)
  }

  const replace66_99Quotes = (input) => {
    // 仅在两侧都不是数字，且至少一侧靠近汉字/中文标点时替换
    const replaceToken = (s, token, outChar) => {
      const re = new RegExp(`(^|[^\\d])${token}([^\\d]|$)`, 'g')
      return s.replace(re, (m, left, right) => {
        const lch = left && left.length ? left[left.length - 1] : ''
        const rch = right && right.length ? right[0] : ''
        if (isCjkOrZhPunct(lch) || isCjkOrZhPunct(rch)) {
          return `${left}${outChar}${right}`
        }
        return m
      })
    }
    let s = input
    s = replaceToken(s, '66', '“')
    s = replaceToken(s, '99', '”')
    return s
  }

  const normalizeEllipsis = (input) => {
    // 把 ...... 或 .. .. 等归一化为 ……；仅在中文语境下（靠近中文/标点）且不夹在数字之间
    const re = /(^|[^\d])(\.{2,})([^\d]|$)/g
    return input.replace(re, (m, left, dots, right) => {
      const lch = left && left.length ? left[left.length - 1] : ''
      const rch = right && right.length ? right[0] : ''
      if (isCjkOrZhPunct(lch) || isCjkOrZhPunct(rch)) {
        return `${left}……${right}`
      }
      return m
    })
  }

  const unifyZhPunct = (input) => {
    // 仅在“汉字前后”把半角标点替换为中文全角，避免影响英文/数字
    const CJK = '[\\u4e00-\\u9fff]'
    let s = input
    s = s.replace(new RegExp(`(${CJK})\\s*,(?=\\s*${CJK})`, 'g'), '$1，')
    s = s.replace(new RegExp(`(${CJK})\\s*,(?=\\s*$)`, 'g'), '$1，')
    s = s.replace(new RegExp(`(${CJK})\\s*\\.(?=\\s*${CJK})`, 'g'), '$1。')
    s = s.replace(new RegExp(`(${CJK})\\s*\\.(?=\\s*$)`, 'g'), '$1。')
    s = s.replace(new RegExp(`(${CJK})\\s*:(?=\\s*${CJK})`, 'g'), '$1：')
    s = s.replace(new RegExp(`(${CJK})\\s*:(?=\\s*$)`, 'g'), '$1：')
    s = s.replace(new RegExp(`(${CJK})\\s*;(?=\\s*${CJK})`, 'g'), '$1；')
    s = s.replace(new RegExp(`(${CJK})\\s*;(?=\\s*$)`, 'g'), '$1；')
    s = s.replace(new RegExp(`(${CJK})\\s*\\!(?=\\s*${CJK})`, 'g'), '$1！')
    s = s.replace(new RegExp(`(${CJK})\\s*\\!(?=\\s*$)`, 'g'), '$1！')
    s = s.replace(new RegExp(`(${CJK})\\s*\\?(?=\\s*${CJK})`, 'g'), '$1？')
    s = s.replace(new RegExp(`(${CJK})\\s*\\?(?=\\s*$)`, 'g'), '$1？')
    // 把全角空格归一为空格
    s = s.replace(/\u3000/g, ' ')
    return s
  }

  if (digitsOnly.value) {
    if (normalizeDigits.value) {
      text = text
        .replace(/[Oo]/g, '0')
        .replace(/[Il]/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
    }
    text = text
      .split('\n')
      .map((line) => line.replace(/[^\d]/g, ''))
      .join('\n')
    if (compressRepeats.value) {
      text = text.replace(/(\d)\1+/g, '$1')
    }
  }

  if (zhPunctFix.value) {
    text = replace66_99Quotes(text)
    text = normalizeEllipsis(text)
    text = unifyZhPunct(text)

    // 将大段空白转成换行（用于把 OCR 的“空格排版”更像分行）
    // - 仅在中文标点纠错开启时生效，避免影响英文段落
    // - 2 个以上空格/Tab/全角空格 视为“分隔”
    text = text
      .replace(/\u3000/g, ' ')
      .replace(/[ \t]{2,}/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return text
}

const fileToImageBitmap = async (f) => {
  // 优先 createImageBitmap（更快、解码更稳），不支持则回退到 Image
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(f)
  }
  const url = URL.createObjectURL(f)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

const canvasToJpegBlob = async (canvas, quality) => {
  const q = Math.min(0.95, Math.max(0.5, quality))
  return await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', q)
  })
}

const mergeImagesToSingleFile = async (fileList) => {
  const bitmaps = []
  for (const f of fileList) {
    // eslint-disable-next-line no-await-in-loop
    bitmaps.push(await fileToImageBitmap(f))
  }

  // 统一宽度（避免不同截图宽度拼接错位）
  const maxWidth = 1400
  const bg = '#ffffff'

  const widths = bitmaps.map((b) => b.width || b.naturalWidth || 0).filter(Boolean)
  const targetW = Math.min(maxWidth, Math.max(1, ...widths))

  const scaledHeights = bitmaps.map((b) => {
    const w = b.width || b.naturalWidth
    const h = b.height || b.naturalHeight
    if (!w || !h) return 0
    return Math.round((h * targetW) / w)
  })

  const totalH = scaledHeights.reduce((sum, h) => sum + h, 0)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = Math.max(1, totalH)
  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let y = 0
  for (let i = 0; i < bitmaps.length; i++) {
    const b = bitmaps[i]
    const w = b.width || b.naturalWidth
    const h = b.height || b.naturalHeight
    const dh = scaledHeights[i]
    if (w && h && dh) {
      ctx.drawImage(b, 0, y, targetW, dh)
      y += dh
    }
  }

  // 目标：尽量不超过 8MB；超了就降质量，仍超就缩放
  const MAX_BYTES = 8 * 1024 * 1024
  let quality = 0.9
  let blob = await canvasToJpegBlob(canvas, quality)
  if (!blob) throw new Error('合并失败：无法生成图片')

  while (blob.size > MAX_BYTES && quality > 0.6) {
    quality -= 0.08
    // eslint-disable-next-line no-await-in-loop
    blob = await canvasToJpegBlob(canvas, quality)
    if (!blob) break
  }

  // 仍超：缩放一次再导出
  if (blob && blob.size > MAX_BYTES) {
    const scale = Math.sqrt(MAX_BYTES / blob.size)
    const w2 = Math.max(600, Math.floor(canvas.width * scale))
    const h2 = Math.max(600, Math.floor(canvas.height * scale))
    const c2 = document.createElement('canvas')
    c2.width = w2
    c2.height = h2
    const ctx2 = c2.getContext('2d', { alpha: false })
    ctx2.fillStyle = bg
    ctx2.fillRect(0, 0, w2, h2)
    ctx2.drawImage(canvas, 0, 0, w2, h2)
    blob = await canvasToJpegBlob(c2, Math.max(0.65, quality))
  }

  if (!blob) throw new Error('合并失败：无法生成图片')
  if (blob.size > MAX_BYTES) {
    throw new Error('合并后的图片过大（>8MB），请减少图片数量或裁剪后重试')
  }

  return new File([blob], `ocr_merged_${Date.now()}.jpg`, { type: 'image/jpeg' })
}

const runOcr = async () => {
  if (files.value.length === 0) return
  errorMessage.value = ''
  resultText.value = ''

  recognizing.value = true
  runningIndex.value = 0
  runningTotal.value = 1

  try {
    // 0) merge
    runningIndex.value = 1
    const mergedFile = await mergeImagesToSingleFile(files.value)

    // 1) upload once
    let imageUrl = ''
    uploading.value = true
    uploadProgress.value = 0
    try {
      const formData = new FormData()
      formData.append('file', mergedFile)
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
    } finally {
      uploading.value = false
      uploadProgress.value = 0
    }

    // 2) ocr once
    const payload = {
      url: imageUrl,
      type: ocrType.value,
      languages: languages.value,
      outputRow: outputRow.value,
      outputParagraph: outputParagraph.value,
      outputTable: outputTable.value
    }
    const ocrRes = await api.post('/ocr', payload)
    if (!ocrRes?.data?.success) throw new Error(ocrRes?.data?.message || 'OCR 识别失败')
    resultText.value = postProcessText(ocrRes?.data?.text || '')
    if (!resultText.value) {
      errorMessage.value = '识别完成，但未提取到文字（可尝试切换类型为 Advanced 或 HandWriting）'
    }
  } catch (err) {
    errorMessage.value = err?.response?.data?.message || err?.message || 'OCR 识别失败'
  } finally {
    recognizing.value = false
    uploading.value = false
    uploadProgress.value = 0
    runningIndex.value = 0
    runningTotal.value = 0
  }
}
</script>

<template>
  <div class="ocr-page">
    <h2 class="title">文字识别（OCR）</h2>

    <div class="panel">
      <div class="left">
        <label class="file-picker">
          <input type="file" accept="image/*" multiple @change="onPickFile" />
          <span>选择图片</span>
        </label>
        <span class="paste-hint">也可以直接粘贴截图（Ctrl+V）</span>

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

        <div v-if="ocrType === 'MultiLang'" class="type-row">
          <span class="type-label">语言</span>
          <input v-model="languages" class="type-input" placeholder="如 chn,eng 或 eng" />
        </div>

        <div v-if="ocrType === 'Advanced'" class="switches">
          <label class="switch">
            <input type="checkbox" v-model="outputRow" />
            <span>按行输出</span>
          </label>
          <label class="switch">
            <input type="checkbox" v-model="outputParagraph" />
            <span>按段输出</span>
          </label>
          <label class="switch">
            <input type="checkbox" v-model="outputTable" />
            <span>表格输出</span>
          </label>
        </div>

        <div class="switches">
          <!--
          <label class="switch">
            <input type="checkbox" v-model="digitsOnly" />
            <span>数字模式</span>
          </label>
          <label class="switch" :class="{ disabled: !digitsOnly }">
            <input type="checkbox" v-model="normalizeDigits" :disabled="!digitsOnly" />
            <span>数字纠错</span>
          </label>
          <label class="switch" :class="{ disabled: !digitsOnly }">
            <input type="checkbox" v-model="compressRepeats" :disabled="!digitsOnly" />
            <span>压缩连续重复</span>
          </label>-->
          <label class="switch">
            <input type="checkbox" v-model="zhPunctFix" />
            <span>中文标点纠错</span>
          </label>
        </div>

        <div v-if="activePreviewUrl" class="preview">
          <img :src="activePreviewUrl" alt="preview" />
        </div>
        <div v-else class="placeholder">
          <span>暂无图片预览</span>
        </div>

        <div v-if="files.length > 1" class="thumbs">
          <div
            v-for="(u, idx) in previewUrls"
            :key="u"
            class="thumb"
            :class="{ active: idx === activeIndex }"
            @click="activeIndex = idx"
            :title="`第 ${idx + 1} 张`"
          >
            <img :src="u" alt="thumb" />
            <button class="thumb-remove" @click.stop="removeAt(idx)" title="移除">×</button>
          </div>
        </div>

        <div class="actions">
          <button class="btn primary" :disabled="!canRun" @click="runOcr">
            {{ recognizing || uploading ? '处理中...' : '开始识别' }}
          </button>
          <button class="btn" :disabled="uploading || recognizing" @click="clearFile">清空</button>
        </div>

        <div v-if="uploading" class="progress">上传中：{{ uploadProgress }}%</div>
        <div v-if="recognizing && runningTotal" class="progress">
          识别中：{{ runningIndex }}/{{ runningTotal }}
        </div>
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
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
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
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 14px;
  width: 100%;
}
.left {
  flex: 0 0 min(380px, 38vw);
  max-width: 100%;
  min-width: 260px;
}
.right {
  flex: 1 1 0;
  min-width: 0;
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
  border-radius: 6px;
  cursor: pointer;
  background: var(--color-green);
  font-size: 0.85rem;
  color: #fff;
}
.paste-hint {
  margin-left: 10px;
  color: #888;
  font-size: 12px;
  user-select: none;
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
  font-size: 0.8rem;
}
.type-input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 6px 10px;
}
.switches {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}
.switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
}
.switch.disabled {
  opacity: 0.6;
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
  font-size: 0.8rem;
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
}
.progress {
  margin-top: 10px;
  color: #666;
  font-size: 12px;
}
.thumbs {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
}
.thumb {
  position: relative;
  height: 64px;
  border: 1px solid #eee;
  border-radius: 6px;
  overflow: hidden;
  background: #fafafa;
  cursor: pointer;
}
.thumb.active {
  outline: 2px solid rgba(74, 157, 217, 0.35);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 9px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  line-height: 18px;
  padding: 0;
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
  font-size: 0.9rem;
}
.error {
  margin-top: 10px;
  color: #d55355;
}

@media (max-width: 768px) {
  .panel {
    flex-direction: column;
    flex-wrap: wrap;
  }
  .left {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }
  .right {
    flex: 1 1 auto;
    width: 100%;
  }
}
</style>

