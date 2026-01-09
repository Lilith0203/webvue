<!-- components/WorkSelector.vue - 作品选择器 -->
<script setup>
import { ref, computed, watch } from 'vue'
import axios from '../api'
import { message } from '../utils/message'

const props = defineProps({
  visible: Boolean,
  excludeIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['cancel', 'select'])

const loading = ref(false)
const works = ref([])
const searchKeyword = ref('')
const selectedWorks = ref([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalPages = ref(1)

// 获取作品列表
const fetchWorks = async () => {
  if (loading.value) return
  
  loading.value = true
  try {
    const response = await axios.get('/works', {
      params: {
        page: currentPage.value,
        size: pageSize.value,
        status: 1, // 只获取已完成的作品
        keyword: searchKeyword.value || undefined
      }
    })
    
    // 过滤掉已在合集中的作品
    const filteredWorks = response.data.works.filter(
      work => !props.excludeIds.includes(work.id)
    )
    
    works.value = filteredWorks
    totalPages.value = Math.ceil(response.data.count / pageSize.value)
  } catch (error) {
    console.error('获取作品列表失败:', error)
    message.error('获取作品列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索作品
const searchWorks = () => {
  currentPage.value = 1
  fetchWorks()
}

// 切换作品选择
const toggleWorkSelection = (work) => {
  const index = selectedWorks.value.findIndex(w => w.id === work.id)
  if (index > -1) {
    selectedWorks.value.splice(index, 1)
  } else {
    selectedWorks.value.push(work)
  }
}

// 检查作品是否已选中
const isSelected = (work) => {
  return selectedWorks.value.some(w => w.id === work.id)
}

// 确认选择
const confirmSelection = () => {
  if (selectedWorks.value.length === 0) {
    message.alert('请至少选择一个作品')
    return
  }
  emit('select', selectedWorks.value)
  selectedWorks.value = []
}

// 取消
const cancel = () => {
  selectedWorks.value = []
  emit('cancel')
}

// 切换页码
const changePage = (page) => {
  currentPage.value = page
  fetchWorks()
}

// 监听 visible 变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    currentPage.value = 1
    searchKeyword.value = ''
    selectedWorks.value = []
    fetchWorks()
  }
})

// 监听搜索关键词变化
watch(searchKeyword, () => {
  if (props.visible) {
    currentPage.value = 1
    fetchWorks()
  }
})
</script>

<template>
  <Transition name="fade">
    <div class="work-selector-overlay" v-if="visible" @click.self="cancel">
      <div class="work-selector">
        <div class="selector-header">
          <h3>选择作品</h3>
          <button class="close-btn" @click="cancel">
            <i class="iconfont icon-guanbi"></i>
          </button>
        </div>
        
        <div class="selector-search">
          <input 
            v-model="searchKeyword"
            type="text"
            placeholder="搜索作品..."
            @keyup.enter="searchWorks"
          >
          <button class="search-btn" @click="searchWorks">
            <i class="iconfont icon-sousuo"></i>
          </button>
        </div>
        
        <div class="selector-content">
          <div v-if="loading" class="loading">加载中...</div>
          <div v-else-if="works.length === 0" class="empty">暂无作品</div>
          <div v-else class="works-list">
            <div 
              v-for="work in works" 
              :key="work.id"
              :class="['work-item', { selected: isSelected(work) }]"
              @click="toggleWorkSelection(work)">
              <div class="work-checkbox">
                <i v-if="isSelected(work)" class="iconfont icon-xuanzhong"></i>
                <i v-else class="iconfont icon-weixuanzhong"></i>
              </div>
              <div class="work-cover">
                <img 
                  v-if="work.pictures && work.pictures.length > 0" 
                  v-image="work.pictures[0]" 
                  :alt="work.name">
                <div v-else class="no-image">暂无图片</div>
              </div>
              <div class="work-info">
                <div class="work-name">{{ work.name }}</div>
                <div class="work-tags">
                  <span 
                    v-for="tag in work.tags" 
                    :key="tag" 
                    class="tag">
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="selector-footer">
          <div class="selected-count">
            已选择: {{ selectedWorks.length }}
          </div>
          <div class="pagination" v-if="totalPages > 1">
            <button 
              class="page-btn" 
              :disabled="currentPage === 1"
              @click="changePage(currentPage - 1)">
              上一页
            </button>
            <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
            <button 
              class="page-btn" 
              :disabled="currentPage === totalPages"
              @click="changePage(currentPage + 1)">
              下一页
            </button>
          </div>
          <div class="actions">
            <button class="cancel-btn" @click="cancel">取消</button>
            <button class="confirm-btn" @click="confirmSelection">确认</button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.work-selector-overlay {
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

.work-selector {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px 10px;
}

.selector-header h3 {
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

.selector-search {
  display: flex;
  gap: 10px;
  padding: 0px 20px;
}

.selector-search input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-btn {
  padding: 4px 6px;
  background: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.selector-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px 0;
  color: #999;
}

.works-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.work-item {
  display: flex;
  flex-direction: column;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.work-item:hover {
  border-color: var(--color-blue);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.work-item.selected {
  border-color: var(--color-blue);
  background: #f0f9ff;
}

.work-checkbox {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.work-checkbox i {
  font-size: 25px;
  color: var(--color-blue);
}

.work-cover {
  aspect-ratio: 4/3;
  overflow: hidden;
  background: #f5f5f5;
}

.work-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 12px;
}

.work-info {
  padding: 10px;
}

.work-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.work-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.work-tags .tag {
  font-size: 11px;
  padding: 2px 6px;
  background: #f0f0f0;
  border-radius: 4px;
  color: #666;
}

.selector-footer {
  padding: 10px 20px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}

.selected-count {
  font-size: 14px;
  color: #666;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-btn {
  padding: 4px 12px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: #666;
}

.actions {
  display: flex;
  gap: 10px;
}

.cancel-btn,
.confirm-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn {
  background: #f5f5f5;
  color: #333;
}

.confirm-btn {
  background: var(--color-blue);
  color: white;
}

.cancel-btn:hover {
  background: #e0e0e0;
}

.confirm-btn:hover {
  opacity: 0.9;
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

