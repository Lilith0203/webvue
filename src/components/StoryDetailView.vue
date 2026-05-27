<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import ImagePreview from './ImagePreview.vue'
import CommentSection from '../components/CommentSection.vue'
import { confirm } from '../utils/confirm'
import { marked } from 'marked'
import {
  showCustomTooltip,
  hideCustomTooltip,
  handleTooltipTouch
} from '../utils/customTooltip'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')

// 添加颜色管理相关状态
const tagColors = ref([])

// 添加图片上传相关状态
const uploadingImage = ref(false)
const imageUploadError = ref(null)

const story = ref(null)
const loading = ref(false)
const error = ref(null)
const editing = ref(false)
/** 笔记多标签：{ id, title, content }；未启用时仅存一段 Markdown */
const detailTabs = ref([])
const detailUsesTabs = ref(false)
const activeDetailTabIndex = ref(0)
let detailTabIdSeq = 0
const genDetailTabId = () => `dt_${Date.now()}_${++detailTabIdSeq}`

const mapParsedTabs = (rawTabs) =>
  rawTabs.map((tab, i) => ({
    id: tab.id || genDetailTabId(),
    title: String(tab.title ?? '').trim().slice(0, 32),
    content: tab.content != null ? String(tab.content) : ''
  }))

/** 从 detail 字段加载；仅当 JSON 且多于 1 个标签时启用 Tab 栏 */
const loadDetailFromStorage = (detail) => {
  if (detail == null || detail === '') {
    detailUsesTabs.value = false
    return [{ id: genDetailTabId(), title: '笔记', content: '' }]
  }
  if (typeof detail !== 'string') {
    detailUsesTabs.value = false
    return [{ id: genDetailTabId(), title: '笔记', content: String(detail) }]
  }
  const trimmed = detail.trim()
  if (trimmed.startsWith('{"tabs"')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const tabs = mapParsedTabs(parsed.tabs)
        detailUsesTabs.value = tabs.length > 1
        return tabs
      }
    } catch {
      // 非法 JSON，按旧版纯文本处理
    }
  }
  detailUsesTabs.value = false
  return [{ id: genDetailTabId(), title: '笔记', content: detail }]
}

/** 仅多标签时存 JSON；单段笔记仍存纯 Markdown */
const serializeDetailForStorage = (tabs) => {
  const list = tabs || []
  if (list.length <= 1) {
    return list[0]?.content ?? ''
  }
  return JSON.stringify({
    tabs: list.map(({ title, content }) => ({
      title: String(title ?? '').trim().slice(0, 32),
      content: content != null ? String(content) : ''
    }))
  })
}

const showDetailTabBar = computed(
  () => detailUsesTabs.value && detailTabs.value.length > 1
)

const activeDetailTab = computed(
  () => detailTabs.value[activeDetailTabIndex.value] || detailTabs.value[0] || null
)

const activeDetailContent = computed(() => activeDetailTab.value?.content ?? '')

const detailDraft = computed({
  get: () => activeDetailTab.value?.content ?? '',
  set: (val) => {
    const tab = detailTabs.value[activeDetailTabIndex.value]
    if (tab) tab.content = val
  }
})

const lastSavedDetailSerialized = ref('')
const isAutoSaving = ref(false)
const detailSaving = ref(false)
const detailSaveError = ref(null)
let autoSaveTimer = null
const showFullDetail = ref(false)
const MAX_DETAIL_LINES = 100
const showBackToTop = ref(false)
const previewVisible = ref(false)
const previewImage = ref('')
const previewImages = ref([])
const currentImageIndex = ref(0)
const previewTitle = ref('')
const relations = ref([])
const relationsLoading = ref(false)
const relationsError = ref(null)
const showAddRelation = ref(false)
const addRelationType = ref('related')
const addRelatedId = ref('')
const addNote = ref('')
const addLoading = ref(false)
const addError = ref(null)
const delLoading = ref({})
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
const searchError = ref(null)
let searchTimeout = null

// 添加编辑关联的状态
const editingRelation = ref(null)
const editRelationType = ref('')
const editRelatedId = ref('')
const editSearchQuery = ref('')
const editSearchResults = ref([])
const editLoading = ref(false)
const editError = ref(null)
let editSearchTimeout = null

// 添加剧情排序导航相关状态
const storyOrder = ref(null)
const orderLoading = ref(false)
const orderError = ref(null)

const comments = ref([])
const loadingComments = ref(false)
const errorComments = ref(null)

// 添加保存导航状态的变量
const savedScrollPosition = ref(0)

// 获取标签颜色
const fetchTagColors = async () => {
  try {
    const response = await axios.get('/colors')
    // 过滤出标签颜色（category: 2）且set为"文本"的颜色
    tagColors.value = response.data.data.filter(color => color.category === 2 && color.set === '文本')
  } catch (error) {
    console.error('获取标签颜色失败:', error)
  }
}

// 处理Markdown内容，为颜色类添加内联样式
const processMarkdownContent = (content) => {
  if (!content) return ''
  
  // 使用marked渲染Markdown
  let rendered = marked(content)
  
  // 为所有标签颜色添加内联样式
  tagColors.value.forEach(color => {
    // 处理已有的class写法
    const classRegex = new RegExp(`class="([^"]*\\s)?${color.name}(\\s[^"]*)?"`, 'g')
    rendered = rendered.replace(classRegex, `class="$1${color.name}$2" style="color: ${color.code};"`)
    
    // 处理简便写法：[文字:color]
    const colorRegex = new RegExp(`\\[([^\\]]+):${color.name}\\]`, 'g')
    rendered = rendered.replace(colorRegex, `<span style="color: ${color.code};">$1</span>`)
  })
  
  // 为所有图片URL添加OSS的resize参数，减少流量
  rendered = rendered.replace(
    /<img([^>]+)src="([^"]+)"([^>]*)>/g,
    (match, before, src, after) => {
      try {
        const url = new URL(src)
        // 如果URL中没有x-oss-process参数，则添加resize参数
        if (!url.searchParams.has('x-oss-process')) {
          url.searchParams.set('x-oss-process', 'image/resize,w_800')
          return `<img${before}src="${url.toString()}"${after}>`
        }
      } catch (e) {
        // 如果URL解析失败，保持原样
        console.warn('无法解析图片URL:', src)
      }
      return match
    }
  )
  
  return rendered
}

/** 从路由读取列表搜索高亮词（由 StoryView 跳转时传入 ?q=） */
const searchHighlightPhrase = computed(() => {
  const raw = route.query.q
  const s = Array.isArray(raw) ? raw[0] : raw
  if (!s || typeof s !== 'string') return ''
  try {
    return decodeURIComponent(s).trim()
  } catch {
    return ''
  }
})

const HIGHLIGHT_OPEN = '<mark class="story-search-highlight">'
const HIGHLIGHT_CLOSE = '</mark>'

/** 在 HTML 中对可见文本做关键词包裹，避免破坏标签结构 */
function applyHighlightToHtml(html, phrase) {
  if (!html || !phrase) return html
  const placeholders = []
  const stripped = html.replace(/<[^>]+>/g, (tag) => {
    const i = placeholders.length
    placeholders.push(tag)
    return `\uE000${i}\uE000`
  })
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped, 'gi')
  const highlighted = stripped.replace(re, `${HIGHLIGHT_OPEN}$&${HIGHLIGHT_CLOSE}`)
  return highlighted.replace(/\uE000(\d+)\uE000/g, (_, i) => placeholders[parseInt(i, 10)])
}

const detailHtmlWithSearchHighlight = computed(() => {
  const base = renderedDetailForDisplayWithMore.value || ''
  const phrase = searchHighlightPhrase.value
  if (!phrase || editing.value) return base
  return applyHighlightToHtml(base, phrase)
})

const storyContentDisplayHtml = computed(() => {
  if (!story.value?.content) return ''
  const html = formatStoryContent(story.value.content)
  const phrase = searchHighlightPhrase.value
  if (!phrase) return html
  return applyHighlightToHtml(html, phrase)
})

// 重新处理剧情详情内容（当颜色加载完成后调用，兼容旧逻辑）
const reprocessStoryDetail = () => {
  if (story.value && activeDetailContent.value && tagColors.value.length > 0) {
    story.value.renderedDetail = processMarkdownContent(activeDetailContent.value)
  }
}

const detailLines = computed(() => {
  const text = activeDetailContent.value || ''
  return text ? text.split(/\r?\n/) : []
})

const isDetailTruncated = computed(() => detailLines.value.length > MAX_DETAIL_LINES)

const truncatedDetailText = computed(() => {
  if (!isDetailTruncated.value) return activeDetailContent.value || ''
  return detailLines.value.slice(0, MAX_DETAIL_LINES).join('\n')
})

const renderedDetailForDisplay = computed(() => {
  const detail = activeDetailContent.value || ''
  if (!detail) return ''
  if (showFullDetail.value || !isDetailTruncated.value) {
    return processMarkdownContent(detail)
  }
  return processMarkdownContent(truncatedDetailText.value)
})

const renderedDetailForDisplayWithMore = computed(() => {
  const html = renderedDetailForDisplay.value || ''
  if (!html) return ''
  if (!isDetailTruncated.value || showFullDetail.value) return html

  // 把“……（查看全文）”插到“最后一行/最后一段”的末尾（通过事件代理处理点击）
  // 优先插入到最后一个 </p> 内部；否则退化为追加到末尾
  const moreHtml = `……<span class="detail-more-inline" data-action="show-full-detail">（查看全文）</span>`
  const idx = html.lastIndexOf('</p>')
  if (idx !== -1) {
    return `${html.slice(0, idx)}${moreHtml}${html.slice(idx)}`
  }
  return `${html}${moreHtml}`
})

const onDetailContentClick = (e) => {
  const target = e && e.target
  if (!target) return
  const action = target.getAttribute && target.getAttribute('data-action')
  if (action === 'show-full-detail') {
    showFullDetail.value = true
  }
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleScroll = () => {
  showBackToTop.value = window.scrollY > 200
}

// 监听tagColors变化，当颜色加载完成后重新处理内容
watch(tagColors, (newColors) => {
  if (newColors.length > 0 && story.value && activeDetailContent.value) {
    reprocessStoryDetail()
  }
}, { immediate: false })

watch(activeDetailTabIndex, () => {
  showFullDetail.value = false
})

const switchDetailTab = (index) => {
  if (index < 0 || index >= detailTabs.value.length) return
  activeDetailTabIndex.value = index
  showFullDetail.value = false
}

const enableDetailTabs = () => {
  if (detailTabs.value.length === 0) {
    detailTabs.value.push({
      id: genDetailTabId(),
      title: '标签1',
      content: ''
    })
  }
  if (detailTabs.value.length === 1) {
    detailTabs.value.push({
      id: genDetailTabId(),
      title: '标签2',
      content: ''
    })
  }
  detailUsesTabs.value = true
  activeDetailTabIndex.value = 0
}

const addDetailTab = () => {
  if (!detailUsesTabs.value) {
    enableDetailTabs()
    return
  }
  const n = detailTabs.value.length + 1
  detailTabs.value.push({
    id: genDetailTabId(),
    title: `标签${n}`,
    content: ''
  })
  activeDetailTabIndex.value = detailTabs.value.length - 1
}

const removeDetailTab = async (index) => {
  if (detailTabs.value.length <= 1) return
  const tab = detailTabs.value[index]
  if (!tab) return
  const label = tab.title?.trim()
  const hint = label ? `「${label}」` : `标签 ${index + 1}`
  if (!(await confirm(`确定删除${hint}吗？`))) return

  detailTabs.value.splice(index, 1)
  if (activeDetailTabIndex.value >= detailTabs.value.length) {
    activeDetailTabIndex.value = detailTabs.value.length - 1
  }
  if (detailTabs.value.length <= 1) {
    detailUsesTabs.value = false
  }
}

const updateDetailTabTitle = (index, title) => {
  const tab = detailTabs.value[index]
  if (!tab) return
  tab.title = String(title ?? '').trim().slice(0, 32)
}

const detailTabDragFrom = ref(null)
const detailTabDropTarget = ref(null)

const moveDetailTab = (fromIndex, toIndex) => {
  const list = detailTabs.value
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
  if (fromIndex >= list.length || toIndex >= list.length) return
  const activeId = list[activeDetailTabIndex.value]?.id
  const [item] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, item)
  const nextActive = list.findIndex((t) => t.id === activeId)
  if (nextActive >= 0) activeDetailTabIndex.value = nextActive
}

const onDetailTabDragStart = (e, index) => {
  detailTabDragFrom.value = index
  e.dataTransfer.setData('text/plain', String(index))
  e.dataTransfer.effectAllowed = 'move'
}

const onDetailTabDragOver = (e, index) => {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  detailTabDropTarget.value = index
}

const onDetailTabDragLeave = () => {
  detailTabDropTarget.value = null
}

const onDetailTabDrop = (e, toIndex) => {
  e.preventDefault()
  const raw = e.dataTransfer.getData('text/plain')
  const from = detailTabDragFrom.value ?? parseInt(raw, 10)
  if (!Number.isFinite(from)) return
  moveDetailTab(from, toIndex)
  detailTabDragFrom.value = null
  detailTabDropTarget.value = null
}

const onDetailTabDragEnd = () => {
  detailTabDragFrom.value = null
  detailTabDropTarget.value = null
}

const cancelEditDetail = () => {
  detailTabs.value = loadDetailFromStorage(story.value?.detail)
  activeDetailTabIndex.value = 0
  showFullDetail.value = false
  detailSaveError.value = null
  editing.value = false
}

const detailRefreshing = ref(false)

/** 进入编辑前拉取服务端最新笔记，避免使用页面上的旧内容 */
const startEditDetail = async () => {
  if (!isAdmin.value || !story.value?.id) return
  detailSaveError.value = null
  detailRefreshing.value = true
  try {
    const res = await axios.get(`/stories/${story.value.id}`)
    const latestDetail = res.data?.data?.detail
    story.value.detail = latestDetail
    detailTabs.value = loadDetailFromStorage(latestDetail)
    activeDetailTabIndex.value = 0
    if (activeDetailContent.value && tagColors.value.length > 0) {
      story.value.renderedDetail = processMarkdownContent(activeDetailContent.value)
    }
    editing.value = true
  } catch {
    detailSaveError.value = '获取最新笔记失败，请稍后重试'
  } finally {
    detailRefreshing.value = false
  }
}

const formatDetailSaveError = (e) => {
  const msg = e?.response?.data?.message
  if (msg) return msg
  if (/too long|Data too long|ER_DATA_TOO_LONG/i.test(String(e?.message || ''))) {
    return '笔记内容过长，请联系管理员检查数据库字段类型'
  }
  return '保存失败，请稍后重试'
}

const relationTypeOptions = [
  { value: 'related', label: '关联' },
  { value: 'prequel', label: '前传' },
  { value: 'sequel', label: '后续' },
  { value: 'parallel', label: '平行' }
]

const fetchStory = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await axios.get(`/stories/${route.params.id}`)
    story.value = res.data.data
    showFullDetail.value = false
    detailTabs.value = loadDetailFromStorage(story.value.detail)
    activeDetailTabIndex.value = 0
    lastSavedDetailSerialized.value = serializeDetailForStorage(detailTabs.value)
    if (activeDetailContent.value && tagColors.value.length > 0) {
      story.value.renderedDetail = processMarkdownContent(activeDetailContent.value)
    }
    await fetchComments()
  } catch (e) {
    error.value = '获取剧情详情失败'
  } finally {
    loading.value = false
  }
}

const saveDetail = async () => {
  if (!isAdmin.value) {
    detailSaveError.value = '无权限：仅管理员可编辑笔记'
    return
  }
  detailSaving.value = true
  detailSaveError.value = null
  try {
    // 只更新笔记内容，其余字段保持不变
    const serialized = serializeDetailForStorage(detailTabs.value)
    if (detailTabs.value.length <= 1) {
      detailUsesTabs.value = false
    }
    const res = await axios.put(`/stories/${story.value.id}`, {
      detail: serialized
    })
    if (res.data?.success === false) {
      throw new Error(res.data?.message || '保存失败')
    }
    story.value.detail = serialized
    lastSavedDetailSerialized.value = serialized
    if (activeDetailContent.value && tagColors.value.length > 0) {
      story.value.renderedDetail = processMarkdownContent(activeDetailContent.value)
    }
    detailSaveError.value = null
    editing.value = false
  } catch (e) {
    detailSaveError.value = formatDetailSaveError(e)
    // 保存失败时保持 editing，避免丢失未保存内容
  } finally {
    detailSaving.value = false
  }
}

// 自动保存：仅在编辑中、内容变化时，每 5 分钟后台保存一次（不退出编辑态）
const autoSaveDetail = async () => {
  if (!isAdmin.value) return
  if (!editing.value) return
  if (!story.value?.id) return
  if (detailSaving.value || isAutoSaving.value) return
  const serialized = serializeDetailForStorage(detailTabs.value)
  if (serialized === lastSavedDetailSerialized.value) return

  isAutoSaving.value = true
  try {
    await axios.put(`/stories/${story.value.id}`, {
      detail: serialized
    })
    story.value.detail = serialized
    lastSavedDetailSerialized.value = serialized
    if (activeDetailContent.value && tagColors.value.length > 0) {
      story.value.renderedDetail = processMarkdownContent(activeDetailContent.value)
    }
  } catch (e) {
    // 自动保存失败不打断用户编辑，仅记录
    console.error('自动保存失败:', e)
  } finally {
    isAutoSaving.value = false
  }
}

watch(editing, (isEditing) => {
  // 进入编辑时，建立基线，启动定时自动保存
  if (isEditing) {
    detailSaveError.value = null
    lastSavedDetailSerialized.value = serializeDetailForStorage(detailTabs.value)
    if (autoSaveTimer) clearInterval(autoSaveTimer)
    autoSaveTimer = setInterval(autoSaveDetail, 5 * 60 * 1000)
  } else {
    if (autoSaveTimer) clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
})

// 图片上传相关方法
const uploadDetailImage = async (file) => {
  if (!file || !file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }

  uploadingImage.value = true
  imageUploadError.value = null

  try {
    // 创建 FormData
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', 'stories')

    // 发送上传请求
    const response = await axios.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    // 获取图片URL
    const imageUrl = response.data.url

    // 在光标位置插入Markdown图片语法
    insertDetailImageMarkdown(imageUrl)
  } catch (error) {
    console.error('上传失败:', error)
    imageUploadError.value = '上传图片失败'
  } finally {
    uploadingImage.value = false
  }
}

// 插入Markdown图片语法到详情文本
const insertDetailImageMarkdown = (imageUrl) => {
  // 解析 URL，移除签名相关参数
  const urlObj = new URL(imageUrl)
  const paramsToRemove = ['Expires', 'OSSAccessKeyId', 'Signature', 'security-token', 'x-oss-process']
  paramsToRemove.forEach(param => urlObj.searchParams.delete(param))
  const cleanImageUrl = urlObj.toString()
  
  const imageMarkdown = `\n![image](${cleanImageUrl})\n`
  
  // 在文本末尾添加图片
  detailDraft.value += imageMarkdown
}

// 处理文件选择
const handleDetailImageUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    uploadDetailImage(file)
  }
  // 清除选择，允许重复选择同一文件
  event.target.value = ''
}

// 处理拖拽
const handleDetailDragOver = (event) => {
  event.preventDefault()
  event.currentTarget.classList.add('dragover')
}

const handleDetailDragLeave = (event) => {
  event.preventDefault()
  event.currentTarget.classList.remove('dragover')
}

const handleDetailDrop = (event) => {
  event.preventDefault()
  event.currentTarget.classList.remove('dragover')
  const file = event.dataTransfer.files[0]
  if (file && file.type.startsWith('image/')) {
    uploadDetailImage(file)
  }
}

async function fetchRelations() {
  if (!story.value?.id) return
  relationsLoading.value = true
  relationsError.value = null
  try {
    const res = await axios.get(`/story-relation/${story.value.id}`)
    if (res.data.success) {
      relations.value = res.data.data
    } else {
      relationsError.value = res.data.message || '获取关联剧情失败'
    }
  } catch (e) {
    relationsError.value = '获取关联剧情失败'
  } finally {
    relationsLoading.value = false
  }
}

// 获取剧情在合集中的排序信息（上一个、下一个）
async function fetchStoryOrder() {
  if (!story.value?.id) return
  
  orderLoading.value = true
  orderError.value = null
  
  try {
    // 优先使用从列表页传递的合集ID，如果没有则使用剧情所属的第一个合集
    let setId
    if (route.query.setId) {
      setId = parseInt(route.query.setId)
    } else if (story.value.sets?.length > 0) {
      setId = story.value.sets[0].id
    } else {
      // 如果没有合集信息，无法获取排序
      orderError.value = '无法获取合集信息'
      return
    }
    
    // 获取排序方向，默认为DESC
    const sortDirection = route.query.sortDirection || 'DESC'
    
    const res = await axios.get(`/story-order/${story.value.id}`, {
      params: { setId, sortDirection }
    })
    
    if (res.data.success) {
      storyOrder.value = res.data.data
    } else {
      orderError.value = res.data.message || '获取排序信息失败'
    }
  } catch (e) {
    orderError.value = '获取排序信息失败'
  } finally {
    orderLoading.value = false
  }
}

// 获取当前排序使用的合集名称
const getCurrentSetName = () => {
  if (!storyOrder.value) return ''
  
  // 优先使用从列表页传递的合集ID
  let setId
  if (route.query.setId) {
    setId = parseInt(route.query.setId)
  } else if (story.value?.sets?.length > 0) {
    setId = story.value.sets[0].id
  }
  
  if (setId && story.value?.sets) {
    const currentSet = story.value.sets.find(set => set.id === setId)
    return currentSet ? currentSet.name : ''
  }
  
  return ''
}

function formatStoryContent(content) {
  if (!content) return '';
  const paragraphs = content.split('\n').filter(line => line.trim() !== '');
  return paragraphs.map(paragraph => {
    const withLinks = paragraph.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="story-link">$1</a>');
    return `<p>${withLinks}</p>`;
  }).join('');
}

// 格式化故事标题，使方括号内的内容高亮显示
const formatStoryTitle = (title) => {
  if (!title) return '';
  
  // 使用正则表达式匹配方括号内的内容
  return title.replace(/\[(.*?)\]/g, '<span class="highlight-text">[$1]</span>');
}

function getThumbnailUrl(url, width = 360) {
  if (Array.isArray(url)) {
    if (url.length === 0) return '';
    url = url[0];
  }
  if (!url) return '';
  return `${url}?x-oss-process=image/resize,w_${width}/sharpen,100`
}

function showImagePreview(pictures, title, index = 0) {
  if (!pictures || (Array.isArray(pictures) && pictures.length === 0)) return;
  if (Array.isArray(pictures)) {
    previewImages.value = pictures;
    previewImage.value = pictures[index]; // 支持初始index
    currentImageIndex.value = index;
  } else {
    previewImages.value = [pictures];
    previewImage.value = pictures;
    currentImageIndex.value = 0;
  }
  previewVisible.value = true;
  previewTitle.value = title || '图片预览';
}

function closePreview() {
  previewVisible.value = false;
}

function prevImage() {
  if (previewImages.value.length <= 1) return;
  currentImageIndex.value = (currentImageIndex.value - 1 + previewImages.value.length) % previewImages.value.length;
  previewImage.value = previewImages.value[currentImageIndex.value];
}

function nextImage() {
  if (previewImages.value.length <= 1) return;
  currentImageIndex.value = (currentImageIndex.value + 1) % previewImages.value.length;
  previewImage.value = previewImages.value[currentImageIndex.value];
}

function relationTypeText(type) {
  // 可根据你的 relationType 设计调整
  const map = {
    prequel: '前',
    sequel: '后',
    parallel: '平行',
    related: '关联'
  }
  return map[type] || type
}

async function handleAddRelation() {
  if (!isAdmin.value) {
    addError.value = '无权限：仅管理员可操作关联剧情'
    return
  }
  if (!addRelatedId.value || !addRelationType.value) {
    addError.value = '请选择关联剧情和类型'
    return
  }
  addLoading.value = true
  addError.value = null
  try {
    const res = await axios.post('/story-relation/add', {
      storyId: story.value.id,
      relatedId: addRelatedId.value,
      relationType: addRelationType.value,
      note: addNote.value
    })
    if (res.data.success) {
      showAddRelation.value = false
      addRelatedId.value = ''
      addNote.value = ''
      await fetchRelations()
    } else {
      addError.value = res.data.message || '添加失败'
    }
  } catch (e) {
    addError.value = '添加失败'
  } finally {
    addLoading.value = false
  }
}

async function handleDeleteRelation(relId) {
  if (!isAdmin.value) return
  if (await confirm('确定要删除关联吗？')) {
    delLoading.value[relId] = true
    try {
      const res = await axios.post('/story-relation/delete', { id: relId })
      if (res.data.success) {
        await fetchRelations()
      } else {
        alert(res.data.message || '删除失败')
      }
    } catch (e) {
      alert('删除失败')
    } finally {
      delLoading.value[relId] = false
    }
  }
}

// 剧情搜索接口
async function searchStories() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  searching.value = true
  searchError.value = null
  try {
    const res = await axios.get('/stories', {
      params: {
        search: searchQuery.value,
        size: 30,
        setIds: (story.value?.sets?.map(set => set.id) || []).join(',')
      }
    })
    if (res.data && Array.isArray(res.data.items)) {
      // 过滤掉自己
      searchResults.value = res.data.items.filter(item => item.id !== story.value.id)
    } else {
      searchResults.value = []
    }
  } catch (e) {
    searchError.value = '搜索失败'
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

// 输入时防抖
function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(searchStories, 300)
}

// 选择剧情
function selectRelatedStory(item) {
  addRelatedId.value = item.id
  searchQuery.value = item.title
  searchResults.value = []
}

function onCancelAddRelation() {
  showAddRelation.value = false
  addRelatedId.value = ''
  searchQuery.value = ''
  searchResults.value = []
  addError.value = null
}

// 添加编辑关联的方法
function startEditRelation(relation) {
  editingRelation.value = relation
  editRelationType.value = relation.relationType
  editRelatedId.value = relation.relatedId
  editSearchQuery.value = relation.relatedStory?.title || ''
  editSearchResults.value = []
  editError.value = null
}

function cancelEditRelation() {
  editingRelation.value = null
  editRelationType.value = ''
  editRelatedId.value = ''
  editSearchQuery.value = ''
  editSearchResults.value = []
  editError.value = null
}

// 编辑关联的搜索功能
async function editSearchStories() {
  if (!editSearchQuery.value.trim()) {
    editSearchResults.value = []
    return
  }
  
  try {
    const res = await axios.get('/stories', {
      params: {
        search: editSearchQuery.value,
        size: 30,
        setIds: (story.value?.sets?.map(set => set.id) || []).join(',')
      }
    })
    if (res.data && Array.isArray(res.data.items)) {
      // 过滤掉自己和当前关联的剧情
      editSearchResults.value = res.data.items.filter(item => 
        item.id !== story.value.id && item.id !== editRelatedId.value
      )
    } else {
      editSearchResults.value = []
    }
  } catch (e) {
    editSearchResults.value = []
  }
}

function onEditSearchInput() {
  clearTimeout(editSearchTimeout)
  editSearchTimeout = setTimeout(editSearchStories, 300)
}

function selectEditRelatedStory(item) {
  editRelatedId.value = item.id
  editSearchQuery.value = item.title
  editSearchResults.value = []
}

async function saveEditRelation() {
  if (!isAdmin.value) {
    editError.value = '无权限：仅管理员可操作关联剧情'
    return
  }
  if (!editRelationType.value || !editRelatedId.value) {
    editError.value = '请选择关联类型和关联剧情'
    return
  }
  
  editLoading.value = true
  editError.value = null
  
  try {
    // 先删除原关联
    await axios.post('/story-relation/delete', { id: editingRelation.value.id })
    
    // 创建新关联
    const res = await axios.post('/story-relation/add', {
      storyId: story.value.id,
      relatedId: editRelatedId.value,
      relationType: editRelationType.value
    })
    
    if (res.data.success) {
      await fetchRelations()
      cancelEditRelation()
    } else {
      editError.value = res.data.message || '更新失败'
    }
  } catch (e) {
    editError.value = '更新失败'
  } finally {
    editLoading.value = false
  }
}

function openAddRelationForm() {
  if (!showAddRelation.value) {
    addRelationType.value = 'related'
    addRelatedId.value = ''
    searchQuery.value = ''
    searchResults.value = []
    addNote.value = ''
    addError.value = null
  }
  showAddRelation.value = !showAddRelation.value
}

const fetchComments = async () => {
  loadingComments.value = true
  errorComments.value = null
  try {
    const res = await axios.get(`/comments/${story.value.id}`, {
      params: {
        type: 3
      }
    })
    comments.value = res.data.comments || []
  } catch (e) {
    errorComments.value = '获取评论失败'
  } finally {
    loadingComments.value = false
  }
}

const submitComment = async (commentData) => {
  try {
    const res = await axios.post('/comment', {
      name: commentData.name,
      content: commentData.content,
      type: 3,
      itemId: story.value.id,
      reply: commentData.reply || 0 // 如果是回复，传递回复的评论ID
    })
    if (res.data.success) {
      await fetchComments() // 重新获取评论
    }
    return res.data
  } catch (e) {
    return { success: false, message: '提交评论失败：' + (e?.message || '网络错误') }
  }
}

const deleteComment = async (commentId) => {
  if (await confirm('确定要删除吗？')) {
    try {
      await axios.post('/comment_delete', { id: commentId })
      await fetchComments()
    } catch (e) {
      alert('删除失败')
    }
  }
}

// 返回前保存当前滚动位置
const handleBack = () => {
  // 如果是从列表页进入的，返回到列表页并带上 from=detail 参数
  //if (route.query.from === 'list') {
    router.push({
      path: '/story',
      query: { from: 'detail' }
    })
  //} else {
    // 如果是从其他详情页进入的，使用浏览器的后退功能
    //router.back()
  //}
}

const navigateToPrevNext = (storyId) => {
  const currentSetId = route.query.setId ? parseInt(route.query.setId) : story.value?.sets?.[0]?.id;
  const currentSortDirection = route.query.sortDirection || 'DESC'; // 获取当前排序方向，默认DESC
  
  router.push({
    path: `/story/${storyId}`,
    query: { 
      setId: currentSetId,
      sortDirection: currentSortDirection // 传递排序方向
    }
  });
};

const navigateToRelatedStory = async (relatedStoryId) => {
  try {
    // 从已有的关联剧情数据中查找目标剧情
    const targetRelation = relations.value.find(rel => rel.relatedStory?.id === relatedStoryId);
    
    if (targetRelation && targetRelation.relatedStory) {
      const relatedStory = targetRelation.relatedStory;
      
      // 获取当前查询的合集ID
      const currentSetId = route.query.setId ? parseInt(route.query.setId) : story.value?.sets?.[0]?.id
      
      // 检查关联剧情是否在当前查询的合集中
      const isInCurrentSet = relatedStory.sets?.some(set => set.id === currentSetId)
      
      let targetSetId = currentSetId
      let targetSortDirection = route.query.sortDirection || 'DESC'
      
      if (!isInCurrentSet && relatedStory.sets?.length > 0) {
        // 如果关联剧情不在当前合集中，从关联剧情的合集中选一个去查询父合集
        // 随便选一个合集ID
        const selectedSetId = relatedStory.sets[0].id
        
        try {
          // 查询该合集的详细信息，获取其父合集
          const setRes = await axios.get(`/story-sets/${selectedSetId}`)
          if (setRes.data.success) {
            // 这里我们只需要知道这个合集是否有父合集
            // 如果有父合集，使用父合集ID；如果没有，使用当前选中的合集ID
            const selectedSet = relatedStory.sets.find(set => set.id === selectedSetId)
            if (selectedSet && selectedSet.parentId && selectedSet.parentId !== 0) {
              // 如果有父合集，使用父合集ID
              targetSetId = selectedSet.parentId
            } else {
              // 如果没有父合集，使用选中的合集ID
              targetSetId = selectedSetId
            }
          } else {
            // 如果查询失败，使用选中的合集ID
            targetSetId = selectedSetId
          }
        } catch (error) {
          console.error('查询合集信息失败:', error)
          // 如果查询失败，使用选中的合集ID
          targetSetId = selectedSetId
        }
        
        // 保持当前的排序方向
        targetSortDirection = route.query.sortDirection || 'DESC'
      }
      
      // 跳转到关联剧情，使用合适的合集ID
      router.push({
        path: `/story/${relatedStoryId}`,
        query: {
          setId: targetSetId,
          sortDirection: targetSortDirection
        }
      })
    } else {
      // 如果没有找到关联剧情信息，使用默认跳转
      const currentSetId = route.query.setId ? parseInt(route.query.setId) : story.value?.sets?.[0]?.id
      router.push({
        path: `/story/${relatedStoryId}`,
        query: {
          setId: currentSetId,
          sortDirection: route.query.sortDirection || 'DESC'
        }
      })
    }
  } catch (error) {
    console.error('跳转关联剧情失败:', error)
    // 如果出错，使用默认跳转
    const currentSetId = route.query.setId ? parseInt(route.query.setId) : story.value?.sets?.[0]?.id
    router.push({
      path: `/story/${relatedStoryId}`,
      query: {
        setId: currentSetId,
        sortDirection: route.query.sortDirection || 'DESC'
      }
    })
  }
};

onMounted(() => {
  // 进入详情页时，滚动到顶部
  window.scrollTo({
    top: 0,
    behavior: 'instant'
  })
  
  fetchStory()
  // 进入详情页面时保存滚动位置
  savedScrollPosition.value = window.scrollY
  
  // 监听路由 id 变化，自动刷新详情
  watch(
    () => route.params.id,
    (id, oldId) => {
      if (id && id !== oldId) {
        fetchStory()
      }
    }
  )
  // 等待剧情加载完再查关联
  watch(
    () => story.value?.id,
    (id) => { if (id) fetchRelations() }
  )
  // 等待剧情加载完再查排序信息
  watch(
    () => story.value?.id,
    (id) => { if (id) fetchStoryOrder() }
  )
  // 获取标签颜色
  fetchTagColors()

  window.addEventListener('scroll', handleScroll)
  handleScroll()
})

onBeforeUnmount(() => {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  autoSaveTimer = null
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <main>
    <div class="content-wrapper">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="story" class="story-detail-card">
        <div class="articles-header">
          <span class="back-link" @click="handleBack()">← 返回列表</span>
        </div>
        <div class="story-header">
          <h1 class="story-title">
            {{ story.title }}
            <i
              v-if="story.isRecommended"
              class="iconfont icon-tuijian recommended-icon"
              @mouseenter="showCustomTooltip($event, story.recReasons || '')"
              @mouseleave="hideCustomTooltip()"
              @touchstart.prevent="handleTooltipTouch($event, story.recReasons || '')"
            ></i>
          </h1>
        </div>
        <div class="meta meta-time">
          <span v-if="story.onlineAt" class="online-time">上线时间：{{ story.onlineAt }}</span>
          <span v-if="story.onlineAt && story.link" class="meta-sep">|</span>
          <span v-if="story.link" class="story-link">
            <a :href="story.link" target="_blank" rel="noopener noreferrer">
              <i class="iconfont icon-bilibili1"></i>
            </a>
          </span>
        </div>
        <div v-if="story.sets?.length" class="meta sets-meta">
          <span class="sets-label">所属合集：</span>
          <span v-for="(set, index) in story.sets" :key="set.id" class="set-item">
            <span class="set-link">
              {{ set.name }}
            </span>
            <span v-if="index < story.sets.length - 1" class="set-sep">、</span>
          </span>
        </div>
        <div class="content-block" v-if="story.content" v-html="storyContentDisplayHtml"></div>
        <div class="pictures" v-if="story.pictures && story.pictures.length">
          <div
            v-for="(pic, i) in story.pictures"
            :key="i"
            class="story-image-area"
            @click="showImagePreview(story.pictures, story.title, i)"
          >
            <img
              v-image="getThumbnailUrl(pic, 360)"
              class="story-thumbnail"
              :alt="`图片${i+1}`"
            />
          </div>
        </div>
        <div class="detail-section">
          <div class="detail-header">
            <h2>笔记.</h2>
            <div class="detail-header__actions">
              <div v-if="editing" class="edit-actions">
                <button class="btn btn-confirm" @click="saveDetail" :disabled="detailSaving" type="button">
                  <i class="iconfont icon-ok"></i>
                </button>
                <button class="btn btn-cancel" @click="cancelEditDetail" :disabled="detailSaving" type="button">
                  <i class="iconfont icon-cancel-test"></i>
                </button>
              </div>
              <button
                v-else-if="isAdmin"
                class="btn btn-edit"
                type="button"
                :disabled="detailRefreshing"
                @click="startEditDetail"
              ><i class="iconfont icon-edit"></i></button>
            </div>
          </div>
          <p
            v-if="!editing && detailSaveError"
            class="detail-save-error"
            role="alert"
          >{{ detailSaveError }}</p>
          <div v-if="editing" class="edit-area">
            <p v-if="detailSaveError" class="detail-save-error" role="alert">{{ detailSaveError }}</p>
            <div v-if="showDetailTabBar" class="detail-tabs detail-tabs--edit">
              <template v-for="(tab, index) in detailTabs" :key="tab.id">
                <button
                  type="button"
                  :class="[
                    'tab-button',
                    {
                      active: activeDetailTabIndex === index,
                      'tab-button--drag-over': detailTabDropTarget === index
                    }
                  ]"
                  @click="switchDetailTab(index)"
                  @dragover.prevent="onDetailTabDragOver($event, index)"
                  @dragleave="onDetailTabDragLeave"
                  @drop.prevent="onDetailTabDrop($event, index)"
                >
                  <span
                    v-if="detailTabs.length > 1"
                    class="detail-tab-drag-handle"
                    draggable="true"
                    title="拖动调整顺序"
                    @dragstart="onDetailTabDragStart($event, index)"
                    @dragend="onDetailTabDragEnd"
                    @click.stop
                  >⋮⋮</span>
                  <span
                    v-if="activeDetailTabIndex === index"
                    class="detail-tab-title-grow"
                  >
                    <span class="detail-tab-title-sizer" aria-hidden="true">{{
                      tab.title ? `${tab.title}\u200b` : '标签标题'
                    }}</span>
                    <input
                      class="detail-tab-title-input"
                      :value="tab.title"
                      maxlength="32"
                      placeholder="标签标题"
                      @click.stop
                      @input="updateDetailTabTitle(index, $event.target.value)"
                    >
                  </span>
                  <span v-else class="detail-tab-label">{{ tab.title || `标签${index + 1}` }}</span>
                  <span
                    v-if="detailTabs.length > 1 && activeDetailTabIndex === index"
                    class="detail-tab-remove"
                    role="button"
                    tabindex="0"
                    title="删除当前标签页"
                    @click.stop="removeDetailTab(index)"
                    @keydown.enter.prevent="removeDetailTab(index)"
                    @keydown.space.prevent="removeDetailTab(index)"
                  >×</span>
                </button>
              </template>
              <button type="button" class="tab-button tab-button--add" title="添加标签页" @click="addDetailTab">
                <i class="iconfont icon-tianjia"></i>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="detail-enable-tabs-btn"
              @click="enableDetailTabs"
            >
              <i class="iconfont icon-tianjia"></i>
            </button>
            <label for="detail-textarea" class="sr-only">编辑笔记内容</label>
            <textarea
              v-model="detailDraft"
              rows="20"
              class="detail-textarea"
              id="detail-textarea"
            ></textarea>

            <!-- 详情图片上传区域 -->
            <div class="detail-images-upload">
              <div 
                class="detail-images-drop-zone"
                @drop="handleDetailDrop"
                @dragover="handleDetailDragOver"
                @dragenter.prevent
                @dragleave="handleDetailDragLeave"
              >
                <input
                  type="file"
                  accept="image/*"
                  @change="handleDetailImageUpload"
                  class="detail-images-file-input"
                  id="detail-images-upload"
                />
                <label for="detail-images-upload" class="detail-images-upload-label">
                  <i class="iconfont icon-tianjia"></i>
                  <span>点击上传或拖拽图片到此处</span>
                </label>
              </div>
              
              <!-- 上传状态和错误提示 -->
              <div v-if="uploadingImage" class="upload-status">
                ⏳ 上传中...
              </div>
              <div v-if="imageUploadError" class="upload-error">
                {{ imageUploadError }}
              </div>
            </div>
            
            <div class="edit-actions">
              <button class="btn btn-confirm" @click="saveDetail" :disabled="detailSaving" type="button">
                <i class="iconfont icon-ok"></i>
              </button>
              <button class="btn btn-cancel" @click="cancelEditDetail" :disabled="detailSaving" type="button">
                <i class="iconfont icon-cancel-test"></i>
              </button>
            </div>
          </div>
          <div v-else>
            <div v-if="showDetailTabBar" class="detail-tabs">
              <button
                v-for="(tab, index) in detailTabs"
                :key="tab.id"
                type="button"
                :class="['tab-button', { active: activeDetailTabIndex === index }]"
                @click="switchDetailTab(index)"
              >
                {{ tab.title || `标签${index + 1}` }}
              </button>
            </div>
            <div class="detail-text">
              <div
                class="detail-text-content"
                v-html="detailHtmlWithSearchHighlight || '<span class=\'empty-detail\'>暂无详情</span>'"
                @click="onDetailContentClick"
              ></div>
            </div>
          </div>
        </div>
        <div class="relation-section">
          <div class="relation-header">
            <h3>关联剧情.</h3>
            <button v-if="isAdmin" class="btn btn-edit" @click="openAddRelationForm" type="button">
              <i class="iconfont icon-tianjia"></i>
            </button>
          </div>
          <div v-if="showAddRelation" class="add-relation-form">
            <label for="add-relation-type" class="sr-only">选择关联类型</label>
            <select v-model="addRelationType" class="add-relation-type" id="add-relation-type">
              <option v-for="opt in relationTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="add-relation-search">
              <label for="add-relation-search-input" class="sr-only">搜索剧情标题</label>
              <input
                v-model="searchQuery"
                class="add-relation-search-input"
                id="add-relation-search-input"
                placeholder="搜索剧情标题"
                @input="onSearchInput"
                autocomplete="off"
              />
              <div v-if="searchResults.length" class="add-relation-suggest">
                <div
                  v-for="item in searchResults"
                  :key="item.id"
                  class="add-relation-suggest-item"
                  @click="selectRelatedStory(item)"
                >{{ item.title }}</div>
              </div>
            </div>
            <button class="btn btn-confirm" :disabled="addLoading || !addRelatedId" @click="handleAddRelation" type="button">
              <i class="iconfont icon-ok"></i>
            </button>
            <button class="btn btn-cancel" @click="onCancelAddRelation" type="button">
              <i class="iconfont icon-cancel-test"></i>
            </button>
            <span v-if="addError" class="add-relation-error">{{ addError }}</span>
          </div>
          <div v-if="relationsLoading" class="relation-loading">加载中...</div>
          <div v-else-if="relationsError" class="relation-error">{{ relationsError }}</div>
          <div v-else-if="relations.length === 0" class="relation-empty">暂无关联剧情</div>
          <div v-else class="relation-list">
            <div v-for="rel in relations" :key="rel.id" class="relation-item">
              <!-- 编辑模式 -->
              <div v-if="editingRelation?.id === rel.id" class="relation-edit-form">
                <label for="edit-relation-type" class="sr-only">选择关联类型</label>
                <select v-model="editRelationType" class="edit-relation-type" id="edit-relation-type">
                  <option v-for="opt in relationTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
                
                <!-- 关联对象搜索 -->
                <div class="edit-relation-search">
                  <label for="edit-relation-search-input" class="sr-only">搜索剧情标题</label>
                  <input
                    v-model="editSearchQuery"
                    class="edit-relation-search-input"
                    id="edit-relation-search-input"
                    placeholder="搜索剧情标题"
                    @input="onEditSearchInput"
                    autocomplete="off"
                  />
                  <div v-if="editSearchResults.length" class="edit-relation-suggest">
                    <div
                      v-for="item in editSearchResults"
                      :key="item.id"
                      class="edit-relation-suggest-item"
                      @click="selectEditRelatedStory(item)"
                    >{{ item.title }}</div>
                  </div>
                </div>
                
                <button
                  class="btn btn-confirm"
                  :disabled="editLoading || !editRelatedId"
                  @click="saveEditRelation"
                  type="button"
                >
                  <i class="iconfont icon-ok"></i>
                </button>
                <button class="btn btn-cancel" @click="cancelEditRelation" type="button">
                  <i class="iconfont icon-cancel-test"></i>
                </button>
                <span v-if="editError" class="edit-relation-error">{{ editError }}</span>
              </div>
              
              <!-- 显示模式 -->
              <div v-else class="relation-display">
                <span class="relation-type">{{ relationTypeText(rel.relationType) }}</span>
                <span class="relation-title" v-if="rel.relatedStory">
                  <a @click.prevent="navigateToRelatedStory(rel.relatedStory.id)" href="#" class="relation-link">
                    {{ rel.relatedStory.title }}
                  </a>
                </span>
                <span v-else class="relation-title relation-missing">[已删除]</span>
                
                <!-- 操作按钮 -->
                <div class="relation-actions">
                  <button
                    v-if="isAdmin"
                    class="btn btn-edit btn-edit-relation"
                    @click="startEditRelation(rel)"
                    title="编辑关联"
                    type="button"
                  >
                    <i class="iconfont icon-edit"></i>
                  </button>
                  <button
                    v-if="isAdmin"
                    class="btn btn-cancel btn-del-relation"
                    :disabled="delLoading[rel.id]"
                    @click="handleDeleteRelation(rel.id)"
                    title="删除关联"
                    type="button"
                  >×</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 剧情导航区域 -->
    <div v-if="storyOrder" class="story-navigation">
      <div class="nav-header">
        <h3>剧情导航.</h3>
        <div class="nav-info">
          <span v-if="getCurrentSetName()" class="nav-set-name">
            {{ getCurrentSetName() }}合集，
          </span>
          <span v-if="storyOrder.current" class="nav-position">
            第 {{ storyOrder.current.position }} 篇，共 {{ storyOrder.total }} 篇
          </span>
        </div>
      </div>
      
      <div class="nav-buttons">
        <button 
          v-if="storyOrder.prev" 
          class="nav-btn nav-prev" 
          @click="navigateToPrevNext(storyOrder.prev.id)"
          type="button"
        >
          <span class="nav-text">
            <div class="nav-label">上一篇</div>
            <div class="nav-title" v-html="formatStoryTitle(storyOrder.prev.title)"></div>
          </span>
        </button>
        
        <button 
          v-if="storyOrder.next" 
          class="nav-btn nav-next" 
          @click="navigateToPrevNext(storyOrder.next.id)"
          type="button"
        >
          <span class="nav-text">
            <div class="nav-label">下一篇</div>
            <div class="nav-title" v-html="formatStoryTitle(storyOrder.next.title)"></div>
          </span>
        </button>
      </div>
    </div>
    
    <CommentSection
      :comments="comments"
      :comment-type="3"
      :comment-item-id="story?.id"
      :onCommentSubmit="submitComment"
      :onCommentDelete="deleteComment"
    />

    <!-- 悬浮置顶按钮（回到顶部） -->
    <div v-if="showBackToTop" class="back-to-top" @click="scrollToTop">
      <i class="iconfont icon-zhiding1"></i>
    </div>
    
    <ImagePreview
      v-if="previewVisible"
      :visible="previewVisible"
      :image-url="previewImage"
      :title="previewTitle"
      :total="previewImages.length"
      :current="currentImageIndex + 1"
      @close="closePreview"
      @prev="prevImage"
      @next="nextImage"
    />
  </main>
</template>

<style scoped>
.content-wrapper {
  max-width: 900px;
  margin: 20px auto 0;
  min-height: 500px;
}

.back-to-top {
  position: fixed;
  right: 5px;
  bottom: 20%;
  width: 30px;
  height: 30px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 1200;
}
.back-to-top .iconfont {
  color: #fff;
  font-size: 30px;
}
.articles-header {
  font-size: 0.9rem;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.back-link {
  color: #499e8d;
  cursor: pointer;
  margin-right: 10px;
}
.back-link:hover {
  color: #fd964c;
}

.story-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
}

.story-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.story-header .story-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 列表搜索进入详情时，关键词底色高亮（v-html 内 mark） */
mark.story-search-highlight {
  background-color: #fff59d;
  color: inherit;
  padding: 0.06em 0.15em;
  border-radius: 3px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}

.recommended-icon {
  color: #fd964c;
  font-size: 1.1rem;
  flex-shrink: 0;
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  cursor: default;
}
.meta {
  color: #888;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-time span {
  line-height: 24px;
}

.online-time {
  color: #888;
  font-size: 0.85rem;
}
.meta-sep {
  font-size: 1em;
  line-height: 1;
  display: flex;
  align-items: center;
  user-select: none;
}
.story-link {
  color: #4a90e2;
  text-decoration: none;
}
.story-link:hover {
  text-decoration: underline;
}
.story-link a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #4a90e2;
  text-decoration: none;
}
.story-link a:hover {
  text-decoration: underline;
}
.icon-bilibili1 {
  font-size: 24px;
  vertical-align: middle;
  display: inline-block;
  margin-right: 0;
}
.content-block {
  margin: 5px 0 15px;
  font-size: 0.85rem;
  color: #444;
  line-height: 1.6;
  background: #f8f8f8;
  border-radius: 6px;
  padding: 8px 10px;
  word-break: break-all;
}
.pictures {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.story-image-area {
  width: 80px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f5f5;
  display: inline-block;
  cursor: pointer;
  position: relative;
}
.story-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  border-radius: 4px;
  display: block;
  pointer-events: none;
  transition: transform 0.2s;
}
.story-image-area:hover .story-thumbnail {
  transform: scale(1.05);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-header__actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
}
.detail-header h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.5;
  display: flex;
  align-items: center;
}

/* 与 Admin 评论管理 tab 一致 */
.detail-tabs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  max-width: 100%;
}

.detail-tabs .tab-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  margin: 0 3px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1.25;
  position: relative;
  color: #666;
  max-width: 10em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-sizing: border-box;
}

.detail-tabs .tab-button:hover {
  color: #444;
}

.detail-tabs .tab-button.active {
  color: var(--color-blue);
  border-bottom: 2px solid var(--color-blue);
}

.detail-tabs--edit .tab-button {
  gap: 6px;
  max-width: none;
  padding-left: 4px;
}

.detail-tabs--edit .tab-button.tab-button--drag-over {
  color: var(--color-blue);
  background: rgba(74, 157, 217, 0.08);
  border-radius: 4px 4px 0 0;
}

.detail-tab-drag-handle {
  display: inline-flex;
  align-items: center;
  align-self: center;
  flex-shrink: 0;
  padding: 0 2px;
  font-size: 0.85rem;
  line-height: 1;
  color: #aaa;
  cursor: pointer;
  user-select: none;
  letter-spacing: -1px;
}

.detail-tab-drag-handle:active {
  cursor: pointer;
}

.detail-tab-drag-handle:hover {
  color: #777;
}

.detail-tab-title-grow {
  display: inline-grid;
  align-self: center;
  max-width: 12em;
  min-width: 0;
}

.detail-tab-title-sizer {
  grid-area: 1 / 1;
  visibility: hidden;
  white-space: pre;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 12em;
  font: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 0;
  margin: 0;
  border: 0;
  pointer-events: none;
}

.detail-tab-title-input {
  grid-area: 1 / 1;
  width: 4em;
  min-width: 0;
  max-width: none;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: inherit;
  padding: 0;
  outline: none;
  line-height: 1.25;
}

.detail-tab-label {
  display: inline-flex;
  align-items: center;
  line-height: 1.25;
  pointer-events: none;
}

.detail-tabs .tab-button--add {
  flex-shrink: 0;
  max-width: none;
  padding: 5px 5px;
}

.detail-tabs .tab-button--add i {
  font-size: 1.05rem;
}

.detail-tab-remove {
  display: inline-flex;
  align-items: center;
  align-self: center;
  flex-shrink: 0;
  margin: 0 -4px 0 0;
  padding: 0 3px;
  font-size: 1.1rem;
  line-height: 1;
  color: #c0392b;
  cursor: pointer;
  user-select: none;
}

.detail-tab-remove:hover {
  color: #a93226;
}

.detail-enable-tabs-btn {
  align-self: flex-start;
  padding: 4px 0;
  border: none;
  background: none;
  color: #499e8d;
  font-size: 0.9rem;
  cursor: pointer;
}

.detail-enable-tabs-btn:hover {
  color: #3d8577;
}

.detail-text {
  white-space: pre-wrap;
  padding: 10px 10px;
  border-radius: 6px;
  min-height: 80px;
  color: #333;
  font-size: 0.9rem;
  margin-bottom: 12px;
  border: 1px dashed #e6e6e6;
}

.detail-more-inside {
  margin-bottom: 0;
  text-align: center;
}

:deep(.detail-more-inline) {
  margin-left: 8px;
  color: #499e8d;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

:deep(.detail-more-inline:hover) {
  opacity: 0.85;
}

/* 动态颜色类，使用CSS变量 */
/* 这些类现在通过内联样式实现，支持所有颜色管理中的标签颜色 */

/* 为Markdown内容添加样式 */
:deep(.detail-text p) {
  line-height: 1.8em;
  margin-bottom: 2px;
  text-align: left;
}

/* 高亮文本样式（方括号内容） */
:deep(.highlight-text) {
  color: #fd964c; /* 高亮颜色，与剧情列表页保持一致 */
}

:deep(.detail-text ul), 
:deep(.detail-text ol) {
  line-height: 1.6;
  margin: 0px;
  text-align: left;
  padding: 0 20px;
}

:deep(.detail-text h1) {
  line-height: 2;
  margin-top: 10px;
  font-weight: bold;
  text-align: left;
}

:deep(.detail-text h3) {
  line-height: 2;
  margin-top: 10px;
  font-weight: bold;
  text-align: left;
}

:deep(.detail-text a) {
  color: #4a9dd9;
  border-bottom: 1px dashed #C9DFFB;
}

:deep(.detail-text strong) {
  font-weight: bold;
}

:deep(.detail-text code) {
  display: block;
  white-space: pre-wrap;
  text-align: left;
  margin: 10px 35px;
  font-size: 13px;
  font-family: inherit;
  color: #575757;
}

:deep(.detail-text img) {
  display: block;
  max-width: 100%;
  margin: 8px auto;
}

:deep(.detail-text blockquote) {
  font-style: italic;
  font-size: 13px;
  text-align: left;
  color: #3E3E3E;
}

:deep(.detail-text table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0;
  font-size: 0.8rem;
  overflow-x: auto;
  min-width: 600px;
}

:deep(.detail-text table th) {
  background-color: #f2f2f2;
  border: 1px solid #ddd;
  padding: 5px;
  text-align: left;
  font-weight: bold;
  white-space: normal;
  word-wrap: break-word;
  word-break: break-all;
}

:deep(.detail-text table td) {
  border: 1px solid #ddd;
  padding: 5px;
  text-align: left;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

:deep(.detail-text table tr:nth-child(even)) {
  background-color: #f9f9f9;
}

:deep(.detail-text table tr:hover) {
  background-color: #f5f5f5;
}

:deep(.detail-text) {
  overflow-x: auto;
}

.empty-detail {
  color: #bbb;
  font-style: italic;
}
.detail-more {
  text-align: center;
}
.detail-more-btn {
  border: none;
  background: transparent;
  color: #4a90e2;
  cursor: pointer;
  font-size: 0.9rem;
}
.detail-more-btn:hover {
  color: #2f76c4;
}

.edit-area {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.detail-save-error {
  margin: 0;
  padding: 8px 10px;
  font-size: 0.85rem;
  line-height: 1.45;
  color: #c0392b;
  background: #fff5f5;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
}

/* 详情图片上传相关样式 */
.detail-images-upload {
  margin-top: 15px;
}

.detail-images-drop-zone {
  position: relative;
  border: 2px dashed #ccc;
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  background: white;
  transition: border-color 0.3s;
  cursor: pointer;
}

.detail-images-drop-zone:hover {
  border-color: #4a90e2;
}

.detail-images-drop-zone.dragover {
  border-color: #4a90e2;
  background: #f0f8ff;
}

.detail-images-file-input {
  opacity: 0;
  height: 100%;
  cursor: pointer;
}

.detail-images-upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #666;
  cursor: pointer;
}

.upload-status {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #4a90e2;
  font-size: 0.85rem;
  margin-top: 10px;
}

.upload-error {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-top: 10px;
}

.detail-textarea {
  width: 100%;
  min-height: 100px;
  border-radius: 6px;
  border: 1px solid #ddd;
  padding: 10px;
  font-size: 1rem;
  background: #f8f8f8;
  resize: vertical;
}
.edit-actions {
  display: flex;
  justify-content: flex-end;
}
.btn {
  padding: 3px 6px;
  border-radius: 4px;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  line-height: 1.5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  box-sizing: border-box;
}
.btn-edit {
  padding: 3px 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #fff;
  border: none;
  cursor: pointer;
}

.btn-edit i{
  font-size: 1.1rem;
}

.btn-confirm {
  background: transparent;
  color: #fff;
}

.btn-confirm:disabled {
  cursor: not-allowed;
}
.btn-cancel {
  background: transparent;
  color: #666;
}

.icon-ok, .icon-cancel-test, .icon-tianjia {
  font-size: 20px;
}

.loading {
  color: #888;
  text-align: center;
  margin: 40px 0;
}
.error {
  color: #e74c3c;
  text-align: center;
  margin: 40px 0;
}

.story-link {
    padding: 0;
}

.relation-section {
  margin-top: 24px;
}
.relation-section h3 {
  font-size: 1rem;
  font-weight: 600;
}
.relation-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.relation-item {
  display: flex;
  align-items: center;
  min-height: 32px;
  gap: 8px;
}
.relation-type {
  color: #fd964c;
  font-size: 0.85rem;
  margin-right: 4px;
}
.relation-title {
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  min-height: 28px;
}
.relation-link {
  display: flex;
  align-items: center;
  height: 100%;
  color: #4a90e2;
  cursor: pointer;
  padding: 0;
}

.relation-link:hover {
  color: #35796b;
}
.relation-note {
  color: #999;
  font-size: 0.92em;
}
.relation-missing {
  display: flex;
  align-items: center;
  color: #bbb;
  font-style: italic;
  min-height: 28px;
}
.relation-loading, .relation-error, .relation-empty {
  color: #bbb;
  font-size: 0.95em;
  margin: 6px 0;
}
.relation-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.add-relation-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  position: relative;
}
.add-relation-type {
  padding: 4px 10px 4px 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 0.85rem;
}

.add-relation-id { width: 90px; }
.add-relation-note { width: 120px; }
.add-relation-error {
  color: #e74c3c;
  margin-left: 8px;
  font-size: 0.95em;
}
.btn-del-relation {
  font-size: 1.1rem;
  padding: 0 8px;
  background: transparent;
  color: #888;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.add-relation-search {
  position: relative;
  width: 180px;
}
.add-relation-search-input {
  width: 100%;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 0.85rem;
}
.add-relation-suggest {
  position: absolute;
  left: 0;
  right: 0;
  top: 110%;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  box-shadow: 0 2px 8px #0001;
  z-index: 10;
  max-height: 180px;
  overflow-y: auto;
}
.add-relation-suggest-item {
  padding: 5px 10px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #444;
}
.add-relation-suggest-item:hover {
  background: #f5f5f5;
}

.sets-meta {
  color: #888;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.sets-label {
  color: #888;
}

.set-item {
  display: inline-flex;
  align-items: center;
}

.set-link {
  color: var(--color-text);
  text-decoration: none;
}

.set-sep {
  color: #888;
  margin: 0 2px;
}

/* 关联编辑表单 */
.relation-edit-form {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.edit-relation-type {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 0.85rem;
  min-width: 80px;
}

.edit-relation-search {
  position: relative;
  width: 180px;
}

.edit-relation-search-input {
  width: 100%;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.edit-relation-suggest {
  position: absolute;
  left: 0;
  right: 0;
  top: 110%;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 4px;
  box-shadow: 0 2px 8px #0001;
  z-index: 10;
  max-height: 180px;
  overflow-y: auto;
}

.edit-relation-suggest-item {
  padding: 5px 10px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #444;
}

.edit-relation-suggest-item:hover {
  background: #f5f5f5;
}

.edit-relation-error {
  color: #e74c3c;
  font-size: 0.85rem;
  margin-left: 8px;
}

.relation-display {
  display: flex;
  align-items: center;
  min-height: 28px;
  gap: 8px;
}

.relation-actions {
  display: flex;
  margin-left: 20px;
}

.btn-edit-relation {
  font-size: 1rem;
  padding: 0px 5px;
  line-height: 1.5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #fff;
  border: none;
  border-radius: 4px;
  transition: background 0.2s;
  cursor: pointer;
}

/* 剧情导航样式 */
.story-navigation {
  margin-top: 24px;
}

.nav-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.nav-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: #333;
}

.nav-info {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
}

.nav-position {
  font-size: 0.85rem;
  color: #666;
  padding: 4px 0px;
}

.nav-set-name {
  padding: 4px 0px;
  border-radius: 4px;
}

.nav-buttons {
  display: flex;
  gap: 30px;
  justify-content: space-between;
}

.nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  min-height: 60px;
}

.nav-btn:hover {
  border-color: #4a90e2;
  box-shadow: 0 2px 8px rgba(74, 144, 226, 0.1);
}

.nav-btn:active {
  transform: translateY(1px);
}

.nav-prev {
  justify-content: flex-start;
}

.nav-next {
  justify-content: flex-end;
}

.nav-text {
  flex: 1;
  min-width: 0;
}

.nav-label {
  font-size: 0.75rem;
  color: #aeaeae;
  margin-bottom: 4px;
}

.nav-title {
  font-size: 0.9rem;
  color: #333;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-btn .iconfont {
  font-size: 16px;
  color: #666;
  flex-shrink: 0;
}

.nav-prev .iconfont {
  order: -1;
}

.nav-next .iconfont {
  order: 1;
}

@media (max-width: 768px) {
  .nav-buttons {
    flex-direction: column;
    gap: 8px;
  }
  
  .nav-btn {
    min-height: 50px;
    padding: 10px 12px;
  }
  
  .nav-title {
    font-size: 0.85rem;
  }
}

@media (min-width: 1024px) {
  :deep(.detail-text img) {
    max-width: 650px;
  }
}

/* 屏幕阅读器专用样式 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>