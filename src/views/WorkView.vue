<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import WorkEditor from '../components/WorkEditor.vue'
import { confirm } from '../utils/confirm'

const authStore = useAuthStore()
//判断是否有编辑权限
const canEdit = computed(() => {
    return authStore.isAuthenticated
})

const pageSize = 12
const page = ref(1)
const loading = ref(false)
const hasMore = ref(true)
const allTags = ref([])
const selectedTags = ref([])
const router = useRouter()
const works = ref([])
// 拖拽相关状态
const showEditor = ref(false)
const editorMode = ref('create')
const currentWork = ref(null)

// 切换标签
const toggleTag = (tag) => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
  // 重置并重新加载
  works.value = []
  page.value = 1
  hasMore.value = true
  fetchWorks()
}

// 打开新建编辑器
const openCreateEditor = () => {
  currentWork.value = null
  editorMode.value = 'create'
  showEditor.value = true
}

// 打开编辑编辑器
const openEditEditor = (work) => {
  currentWork.value = work
  editorMode.value = 'edit'
  showEditor.value = true
}

// 处理编辑成功
const handleEditorSuccess = async () => {
  // 更新列表数据
  showEditor.value = false
  //重置列表状态
  hasMore.value = true
  works.value = []
  page.value = 1
  await fetchWorks()
  await fetchTags()
}

// 关闭编辑器
const closeEditor = () => {
  showEditor.value = false
}

// 获取作品列表
const fetchWorks = async () => {
  if (loading.value || !hasMore.value) return

  loading.value = true
  try {
    const response = await axios.get('/works', {
      params: {
        page: page.value,
        size: pageSize,
        tags: selectedTags.value.length > 0 ? selectedTags.value.join(',') : undefined
      }
    })
    if (page.value === 1) {
      works.value = response.data.works
    } else {
      works.value = [...works.value, ...response.data.works]
    }
    hasMore.value = response.data.works.length === pageSize
    page.value++
  } catch (error) {
    console.error('获取作品列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载更多
const loadMore = () => {
  fetchWorks()
}

// 删除作品
const deleteWork = async (id) => {
  const confirmed = await confirm('确定要删除这个作品吗？')
  if (!confirmed) {
    return
  }
  
  try {
    await axios.post(`/works/delete`, {id:id})
    await fetchWorks()
    await fetchTags()
  } catch (error) {
    console.error('删除作品失败:', error)
  }
}

// 跳转到详情页
const goToDetail = (id) => {
  router.push(`/works/${id}`)
}

// 格式化日期
const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

// 获取所有标签
const fetchTags = async () => {
  try {
    const response = await axios.get('/worktags')
    allTags.value = response.data.data.tags
  } catch (error) {
    console.error('获取标签失败:', error)
  }
}

onMounted(() => {
  fetchWorks()
  fetchTags()
})

onUnmounted(() => {
})
</script>

<template>
  
    <WorkEditor 
      v-if="showEditor"
      :visible="showEditor"
      :mode="editorMode"
      :work="currentWork"
      @success="handleEditorSuccess"
      @cancel="closeEditor"/><!-- 编辑弹窗 -->
    <template v-else>
      <div class="header">
        <h2>作品展示</h2>
        <button v-if="canEdit" class="add-btn" @click="openCreateEditor">新增 +</button>
      </div>
      <div class="filter-tags">
          <a v-for="tag in allTags" 
              :key="tag"
              href="#"
              :class="['tag', { active: selectedTags.includes(tag) }]"
              @click.prevent="toggleTag(tag)"
          >{{ tag }}</a>
        </div>

      <!-- 作品网格展示 -->
      <div class="work-grid">
        <div 
          v-for="work in works" 
          :key="work.id" 
          class="work-card"
        >
          <!-- 封面图 -->
          <div class="work-cover" @click="goToDetail(work.id)">
            <img
            v-if="work.pictures && work.pictures.length > 0" 
            v-image="work.pictures[0]" alt="封面">
            <div v-else class="no-image">
              暂无图片
            </div>
          </div>
          
          <!-- 作品信息 -->
          <div class="work-info">
            <div class="work-header">
              <h3 @click="goToDetail(work.id)">{{ work.name }}</h3>
              <!-- 操作按钮 -->
              <div class="actions" v-if="canEdit">
                <button @click="openEditEditor(work)"><i class="iconfont icon-bianji"></i></button>
                <button @click="deleteWork(work.id)"><i class="iconfont icon-shanchu"></i></button>
              </div>
            </div>
            <!--<p class="description">{{ work.description }}</p>-->
            <div class="tags">
              <span 
                v-for="tag in work.tags" 
                :key="tag" 
                class="tag"
                @click.prevent="toggleTag(tag)"
              >
                <a>{{ tag }}</a>
              </span>
            </div>
            <div class="update-time">
              更新时间: {{ formatDate(work.updatedAt) }}
            </div>
          </div>
        </div>
      </div>
      <!-- 加载更多 -->
      <div class="load-more" v-if="hasMore">
        <a href="#" @click.prevent="loadMore">
          {{ loading ? '加载中...' : '查看更多' }}
        </a>
      </div>
    </template>
</template>

<style scoped>
.work-view {
  padding: 20px 0;
  max-width: 1200px;
  margin: 30px auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  margin-top: 10px;
}

.header h2 {
  font-size: 1rem;
  font-weight: bold;
}

.add-btn {
  padding: 4px 6px;
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.work-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.3s;
}

.work-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.work-cover {
  aspect-ratio: 16/9;
  overflow: hidden;
  cursor: pointer;
}

.work-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work-info {
  padding: 10px 15px;
  font-size: 1rem;
}

.work-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.work-info h3 {
  font-size: 1rem;
  cursor: pointer;
}

.description {
  color: #666;
  margin: 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}

.tag {
  padding: 2px 5px;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 12px;
}

/* 添加新样式 */
.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}

.tag.active {
  background: var(--color-blue);
  color: white;
}

.load-more {
  text-align: center;
  margin: 20px 0;
}

.load-more a {
  display: inline-block;
  padding: 8px 24px;
  color: var(--color-primary);
  text-decoration: none;
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  transition: all 0.3s ease;
}

.load-more a:hover {
  background: var(--color-primary);
  color: white;
}

.load-more a.loading {
  opacity: 0.7;
  cursor: not-allowed;
}

.update-time {
  font-size: 12px;
  color: #999;
}

.actions {
  display: flex;
  gap: 10px;
}

.actions button {
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.actions button:hover {
  border: 1px dashed #ddd;
}

.drag-handle {
  position: absolute;
  bottom: 5px;
  right: 5px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 2px 4px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: move;
  user-select: none;
}

.no-image {
  width: 100%;
  height: 100%;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
}

@media (max-width: 768px) {
  .work-view {
    margin-top: 0;
  }

  .work-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }

  .preview-item {
    touch-action: none; /* 防止触摸设备的默认行为 */
  }
  
  .drag-handle {
    opacity: 1; /* 在移动端始终显示拖动手柄 */
    padding: 4px 8px; /* 更大的点击区域 */
  }
}
</style>