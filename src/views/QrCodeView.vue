<script setup>
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { renderStyledQrDataUrl } from '../utils/qrCanvas'

const content = ref('')
const size = ref(280)
const margin = ref(2)
const errorLevel = ref('M')
const darkColor = ref('#000000')
const lightColor = ref('#ffffff')
const useGradient = ref(false)
const gradientStart = ref('#4a9dd9')
const gradientEnd = ref('#499e8d')
const gradientAngle = ref(135)
const frameStyle = ref('none')
const caption = ref('')
const captionColor = ref('#333333')
const captionFontSize = ref(16)

const qrDataUrl = ref('')
const generating = ref(false)
const errorMsg = ref('')

const frameStyleOptions = [
  { value: 'none', label: '无边框' },
  { value: 'rounded', label: '圆角边框' },
  { value: 'square', label: '直角边框' }
]

const generateQr = async () => {
  const text = content.value.trim()
  if (!text) {
    qrDataUrl.value = ''
    errorMsg.value = ''
    return
  }

  generating.value = true
  errorMsg.value = ''
  try {
    qrDataUrl.value = await renderStyledQrDataUrl(text, {
      size: size.value,
      margin: margin.value,
      errorCorrectionLevel: errorLevel.value,
      darkColor: darkColor.value,
      lightColor: lightColor.value,
      useGradient: useGradient.value,
      gradientStart: gradientStart.value,
      gradientEnd: gradientEnd.value,
      gradientAngle: gradientAngle.value,
      frameStyle: frameStyle.value,
      caption: caption.value,
      captionColor: captionColor.value,
      captionFontSize: captionFontSize.value,
      captionGap: 12
    })
  } catch (err) {
    qrDataUrl.value = ''
    errorMsg.value = err?.message || '生成失败，请检查输入内容'
  } finally {
    generating.value = false
  }
}

let debounceTimer = null
watch(
  [
    content,
    size,
    margin,
    errorLevel,
    darkColor,
    lightColor,
    useGradient,
    gradientStart,
    gradientEnd,
    gradientAngle,
    frameStyle,
    caption,
    captionColor,
    captionFontSize
  ],
  () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(generateQr, 200)
  }
)

const downloadQr = () => {
  if (!qrDataUrl.value) return
  const link = document.createElement('a')
  link.href = qrDataUrl.value
  link.download = `qrcode-${Date.now()}.png`
  link.click()
}

const fillExample = (text) => {
  content.value = text
}
</script>

<template>
  <div class="qrcode-view">
    <div class="page-header">
      <RouterLink to="/program" class="back-link">← 返回小游戏</RouterLink>
      <h1>二维码生成</h1>
      <p class="subtitle">输入文字、链接或任意文本，自定义样式并添加底部说明文字。</p>
    </div>

    <div class="main-layout">
      <section class="panel input-panel">
        <label class="field-label" for="qr-content">内容</label>
        <textarea
          id="qr-content"
          v-model="content"
          rows="5"
          placeholder="例如：https://www.lilithu.com/ 或一段文字"
        ></textarea>

        <div class="quick-examples">
          <span class="examples-label">示例：</span>
          <button type="button" class="example-btn" @click="fillExample('https://www.lilithu.com/')">网址</button>
          <button type="button" class="example-btn" @click="fillExample('你好，世界')">文字</button>
        </div>

        <label class="field-label section-label" for="qr-caption">底部文字</label>
        <textarea
          id="qr-caption"
          v-model="caption"
          rows="2"
          placeholder="显示在二维码下方，支持换行，可留空"
        ></textarea>

        <div class="options-grid">
          <div class="option-item">
            <label for="qr-size">尺寸 {{ size }}px</label>
            <input id="qr-size" v-model.number="size" type="range" min="160" max="512" step="8">
          </div>

          <div class="option-item">
            <label for="qr-margin">边距 {{ margin }}</label>
            <input id="qr-margin" v-model.number="margin" type="range" min="0" max="8" step="1">
          </div>

          <div class="option-item">
            <label for="qr-level">容错</label>
            <select id="qr-level" v-model="errorLevel">
              <option value="L">低 (7%)</option>
              <option value="M">中 (15%)</option>
              <option value="Q">较高 (25%)</option>
              <option value="H">高 (30%)</option>
            </select>
          </div>

          <div class="option-item option-item-full">
            <label class="gradient-toggle">
              <input v-model="useGradient" type="checkbox">
              前景使用渐变色
            </label>
          </div>

          <div v-if="!useGradient" class="option-item color-item">
            <label for="qr-dark">前景色</label>
            <input id="qr-dark" v-model="darkColor" type="color">
          </div>

          <template v-if="useGradient">
            <div class="option-item color-item">
              <label for="qr-gradient-start">渐变起始色</label>
              <input id="qr-gradient-start" v-model="gradientStart" type="color">
            </div>

            <div class="option-item color-item">
              <label for="qr-gradient-end">渐变结束色</label>
              <input id="qr-gradient-end" v-model="gradientEnd" type="color">
            </div>

            <div class="option-item option-item-full">
              <label for="qr-gradient-angle">渐变角度 {{ gradientAngle }}°</label>
              <input
                id="qr-gradient-angle"
                v-model.number="gradientAngle"
                type="range"
                min="0"
                max="360"
                step="1"
              >
            </div>
          </template>

          <div class="option-item">
            <label for="qr-frame-style">外框</label>
            <select id="qr-frame-style" v-model="frameStyle">
              <option v-for="item in frameStyleOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </div>

          <div class="option-item">
            <label for="qr-caption-size">底部字号 {{ captionFontSize }}px</label>
            <input
              id="qr-caption-size"
              v-model.number="captionFontSize"
              type="range"
              min="12"
              max="28"
              step="1"
            >
          </div>

          <div class="option-item color-item">
            <label for="qr-light">背景色</label>
            <input id="qr-light" v-model="lightColor" type="color">
          </div>

          <div class="option-item color-item">
            <label for="qr-caption-color">底部文字色</label>
            <input id="qr-caption-color" v-model="captionColor" type="color">
          </div>
        </div>
      </section>

      <section class="panel preview-panel">
        <h2 class="preview-title">预览</h2>
        <div class="preview-box">
          <div v-if="generating" class="preview-placeholder">生成中…</div>
          <div v-else-if="!content.trim()" class="preview-placeholder">请输入内容</div>
          <div v-else-if="errorMsg" class="preview-placeholder error">{{ errorMsg }}</div>
          <img v-else :src="qrDataUrl" alt="二维码预览" class="qr-image">
        </div>
        <button
          type="button"
          class="download-btn"
          :disabled="!qrDataUrl"
          @click="downloadQr"
        >
          下载 PNG
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.qrcode-view {
  max-width: 900px;
  margin: 15px auto 40px;
  padding: 0 12px;
}

.page-header {
  margin-bottom: 20px;
}

.back-link {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  color: var(--color-green);
  text-decoration: none;
}

.back-link:hover {
  opacity: 0.85;
}

.page-header h1 {
  margin: 0 0 6px;
  font-size: 1.2rem;
  font-weight: bold;
}

.subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: #666;
}

.main-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
  align-items: start;
}

.panel {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 16px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  font-weight: bold;
}

.section-label {
  margin-top: 16px;
}

textarea,
input[type='text'] {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.9rem;
  line-height: 1.5;
  font-family: inherit;
}

textarea {
  resize: vertical;
  max-height: 90px;
}

textarea:focus,
input[type='text']:focus {
  outline: none;
  border-color: var(--color-blue);
}

.quick-examples {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.examples-label {
  font-size: 0.85rem;
  color: #888;
}

.example-btn {
  padding: 2px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fafafa;
  font-size: 0.8rem;
  cursor: pointer;
}

.example-btn:hover {
  border-color: var(--color-blue);
  color: var(--color-blue);
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  margin-top: 12px;
}

.option-item label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.85rem;
  color: #555;
}

.option-item input[type='range'] {
  width: 100%;
}

.option-item select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85rem;
}

.option-item-full {
  grid-column: 1 / -1;
}

.gradient-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #555;
  cursor: pointer;
}

.gradient-toggle input {
  margin: 0;
}

.color-item input[type='color'] {
  width: 100%;
  height: 34px;
  padding: 2px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.preview-panel {
  text-align: center;
}

.preview-title {
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: bold;
}

.preview-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px dashed #e0e0e0;
}

.preview-placeholder {
  font-size: 0.9rem;
  color: #999;
}

.preview-placeholder.error {
  color: var(--color-red, #d25656);
}

.qr-image {
  max-width: 100%;
  height: auto;
  display: block;
}

.download-btn {
  margin-top: 14px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: var(--color-blue);
  color: #fff;
  font-size: 0.9rem;
  cursor: pointer;
}

.download-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.download-btn:not(:disabled):hover {
  opacity: 0.9;
}

@media (max-width: 768px) {
  .main-layout {
    grid-template-columns: 1fr;
  }

  .preview-panel {
    order: -1;
  }
}
</style>
