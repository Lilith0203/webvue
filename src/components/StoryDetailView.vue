<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import ImagePreview from './ImagePreview.vue'
import CommentSection from '../components/CommentSection.vue'
import { confirm } from '../utils/confirm'
import { marked } from 'marked'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 添加颜色管理相关状态
const tagColors = ref([])

const story = ref(null)
const loading = ref(false)
const error = ref(null)
const editing = ref(false)
const detailDraft = ref('')
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
    const regex = new RegExp(`class="([^"]*\\s)?${color.name}(\\s[^"]*)?"`, 'g')
    rendered = rendered.replace(regex, `class="$1${color.name}$2" style="color: ${color.code};"`)
  })
  
  return rendered
}

const relationTypeOptions = [
  { value: 'prequel', label: '前传' },
  { value: 'sequel', label: '后续' },
  { value: 'parallel', label: '平行' },
  { value: 'related', label: '关联' }
]

const fetchStory = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await axios.get(`/stories/${route.params.id}`)
    story.value = res.data.data
    detailDraft.value = story.value.detail || ''
    // 对detail内容进行Markdown渲染
    if (story.value.detail) {
      story.value.renderedDetail = processMarkdownContent(story.value.detail)
    }
    await fetchComments()
  } catch (e) {
    error.value = '获取剧情详情失败'
  } finally {
    loading.value = false
  }
}

const saveDetail = async () => {
  loading.value = true
  error.value = null
  try {
    await axios.put(`/stories/${story.value.id}`, {
      ...story.value,
      detail: detailDraft.value
    })
    story.value.detail = detailDraft.value
    // 更新渲染后的内容
    if (story.value.detail) {
      story.value.renderedDetail = processMarkdownContent(story.value.detail)
    }
    editing.value = false
  } catch (e) {
    error.value = '保存失败'
  } finally {
    loading.value = false
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

function formatStoryContent(content) {
  if (!content) return '';
  const paragraphs = content.split('\n').filter(line => line.trim() !== '');
  return paragraphs.map(paragraph => {
    const withLinks = paragraph.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="story-link">$1</a>');
    return `<p>${withLinks}</p>`;
  }).join('');
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
        type: 3,
        approval: 'approved'
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
    } else {
      alert(res.data.message)
    }
  } catch (e) {
    alert('提交评论失败')
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
  if (route.query.from === 'list') {
    router.push({
      path: '/story',
      query: { from: 'detail' }
    })
  } else {
    // 如果是从其他详情页进入的，使用浏览器的后退功能
    router.back()
  }
}

onMounted(() => {
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
  // 获取标签颜色
  fetchTagColors()
})
</script>

<template>
  <main>
    <div class="content-wrapper">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="story" class="story-detail-card">
        <div class="articles-header">
          <span class="back-link" @click="handleBack()">← 返回</span>
          <span v-if="story.isRecommended" class="recommended">推荐</span>
        </div>
        <h1 class="story-title">{{ story.title }}</h1>
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
        <div class="content-block" v-if="story.content" v-html="formatStoryContent(story.content)"></div>
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
            <h2>笔记</h2>
            <button
              v-if="!editing && authStore.isAuthenticated"
              class="btn btn-edit"
              @click="editing=true"
            ><i class="iconfont icon-edit"></i></button>
          </div>
          <div v-if="editing" class="edit-area">
            <textarea v-model="detailDraft" rows="20" class="detail-textarea"></textarea>
            <div class="edit-actions">
              <button class="btn btn-confirm" @click="saveDetail" :disabled="loading">
                <i class="iconfont icon-ok"></i>
              </button>
              <button class="btn btn-cancel" @click="editing=false">
                <i class="iconfont icon-cancel-test"></i>
              </button>
            </div>
          </div>
          <div v-else>
            <div class="detail-text" v-html="story.renderedDetail || '<span class=\'empty-detail\'>暂无详情</span>'"></div>
          </div>
        </div>
        <div class="relation-section">
          <div class="relation-header">
            <h3>关联剧情</h3>
            <button v-if="authStore.isAuthenticated" class="btn btn-edit" @click="openAddRelationForm">
              <i class="iconfont icon-tianjia"></i>
            </button>
          </div>
          <div v-if="showAddRelation" class="add-relation-form">
            <select v-model="addRelationType" class="add-relation-type">
              <option v-for="opt in relationTypeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <div class="add-relation-search">
              <input
                v-model="searchQuery"
                class="add-relation-search-input"
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
            <button class="btn btn-confirm" :disabled="addLoading || !addRelatedId" @click="handleAddRelation">
              <i class="iconfont icon-ok"></i>
            </button>
            <button class="btn btn-cancel" @click="onCancelAddRelation">
              <i class="iconfont icon-cancel-test"></i>
            </button>
            <span v-if="addError" class="add-relation-error">{{ addError }}</span>
          </div>
          <div v-if="relationsLoading" class="relation-loading">加载中...</div>
          <div v-else-if="relationsError" class="relation-error">{{ relationsError }}</div>
          <div v-else-if="relations.length === 0" class="relation-empty">暂无关联剧情</div>
          <div v-else class="relation-list">
            <div v-for="rel in relations" :key="rel.id" class="relation-item">
              <span class="relation-type">{{ relationTypeText(rel.relationType) }}</span>
              <span class="relation-title" v-if="rel.relatedStory">
                <a @click.prevent="router.push(`/story/${rel.relatedStory.id}`)" href="#" class="relation-link">
                  {{ rel.relatedStory.title }}
                </a>
              </span>
              <span v-else class="relation-title relation-missing">[已删除]</span>
              <span v-if="rel.note" class="relation-note">（{{ rel.note }}）</span>
              <button
                v-if="authStore.isAuthenticated"
                class="btn btn-cancel btn-del-relation"
                :disabled="delLoading[rel.id]"
                @click="handleDeleteRelation(rel.id)"
                title="删除关联"
              >×</button>
            </div>
          </div>
        </div>
      </div>
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
    <CommentSection
      :comments="comments"
      :onCommentSubmit="submitComment"
      :onCommentDelete="deleteComment"
    />
  </main>
</template>

<style scoped>
.content-wrapper {
  max-width: 900px;
  margin: 30px auto 0;
  min-height: 500px;
}
.articles-header {
  font-size: 0.9rem;
  margin-bottom: 1rem;
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
.recommended {
  color: #fd964c;
  font-size: 0.8rem;
  background: #fff7e6;
  border-radius: 4px;
  padding: 2px 8px;
  margin-left: 8px;
}
.story-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px 0;
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
  font-size: 0.9rem;
  color: #444;
  line-height: 1.6;
  background: #f8f8f8;
  border-radius: 6px;
  padding: 12px 10px;
  word-break: break-all;
}
.pictures {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
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
  margin-bottom: 10px;
}
.detail-header h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  line-height: 1.5;
  display: flex;
  align-items: center;
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

/* 动态颜色类，使用CSS变量 */
/* 这些类现在通过内联样式实现，支持所有颜色管理中的标签颜色 */

/* 为Markdown内容添加样式 */
:deep(.detail-text p) {
  line-height: 1.8em;
  margin-bottom: 6px;
  text-align: left;
}

:deep(.detail-text ul), 
:deep(.detail-text ol) {
  font-size: 14px;
  line-height: 1.6em;
  margin-bottom: 6px;
  text-align: left;
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
  border: 3px solid #fff;
  box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.2);
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
  margin: 15px 0;
  font-size: 12px;
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
.edit-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  gap: 10px;
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
  font-size: 1rem;
  padding: 3px 12px;
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
.btn-del-relation:hover {
  background: #fdcfcf;
  color: #e74c3c;
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
</style>