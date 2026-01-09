<!-- components/WorkList.vue - 可复用的作品列表组件 -->
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import axios from '../api'
import { getTagColor } from '../utils/tags'

const props = defineProps({
  works: {
    type: Array,
    required: true,
    default: () => []
  },
  showTopBtn: {
    type: Boolean,
    default: false
  },
  showEditActions: {
    type: Boolean,
    default: false
  },
  showTagFilter: {
    type: Boolean,
    default: false
  },
  onTagClick: {
    type: Function,
    default: null
  },
  onEdit: {
    type: Function,
    default: null
  },
  onDelete: {
    type: Function,
    default: null
  },
  onTop: {
    type: Function,
    default: null
  },
  onLike: {
    type: Function,
    default: null
  },
  onRecommend: {
    type: Function,
    default: null
  },
  showRemoveFromSet: {
    type: Boolean,
    default: false
  },
  onRemoveFromSet: {
    type: Function,
    default: null
  },
  fromSet: {
    type: Boolean,
    default: false
  },
  setId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['work-click'])

const router = useRouter()
const authStore = useAuthStore()
const canEdit = computed(() => authStore.isAuthenticated)

// 获取作品标签样式
const getWorkTagStyle = (tag) => {
  const bgColor = getTagColor(tag)
  return {
    backgroundColor: 'transparent',
    color: bgColor
  }
}

// 格式化日期
const formatDate = (date) => {
  return new Date(date).toLocaleString()
}

// 获取缩略图URL
const getThumbUrl = (url, width = 800) => {
  if (!url) return ''
  return `${url}?x-oss-process=image/resize,w_${width}`
}

// 跳转到详情页
const goToDetail = (id) => {
  emit('work-click', id)
  // 如果是从合集页跳转，传递 set 参数
  if (props.fromSet && props.setId) {
    router.push(`/works/${id}?from=set&setId=${props.setId}`)
  } else {
    router.push(`/works/${id}?from=list`)
  }
}

// 处理标签点击
const handleTagClick = (tag) => {
  if (props.onTagClick) {
    props.onTagClick(tag)
  }
}

// 处理编辑
const handleEdit = (work) => {
  if (props.onEdit) {
    props.onEdit(work)
  }
}

// 处理删除
const handleDelete = (id) => {
  if (props.onDelete) {
    props.onDelete(id)
  }
}

// 处理置顶
const handleTop = (event, id) => {
  if (props.onTop) {
    props.onTop(event, id)
  }
}

// 处理点赞
const handleLike = (event, id) => {
  if (props.onLike) {
    props.onLike(event, id)
  }
}

// 处理推荐
const handleRecommend = (event, id) => {
  if (props.onRecommend) {
    props.onRecommend(event, id)
  }
}

// 处理从合集移出
const handleRemoveFromSet = (event, id) => {
  event.stopPropagation()
  if (props.onRemoveFromSet) {
    props.onRemoveFromSet(id)
  }
}
</script>

<template>
  <div class="work-grid">
    <div 
      v-for="work in works" 
      :key="work.id" 
      class="work-card">
      <!-- 封面图 -->
      <div class="work-cover" @click="goToDetail(work.id)">
        <img
          v-if="work.pictures && work.pictures.length > 0" 
          v-image="getThumbUrl(work.pictures[0])" alt="封面">
        <div v-else class="no-image">
          暂无图片
        </div>
        
        <!-- 置顶按钮（右上角） -->
        <div v-if="showTopBtn && canEdit" class="top-btn" @click="handleTop($event, work.id)">
          <i :class="['iconfont', work.top > 0 ? 'icon-zhiding1' : 'icon-zhiding2']"></i>
        </div>
        
        <!-- 交互按钮 -->
        <div class="interaction-overlay">
          <div class="interaction-btn" @click="handleLike($event, work.id)">
            <i :class="['iconfont', work.hasLiked ? 'icon-dianzan' : 'icon-dianzan-0']"></i>
            <span>{{ work.likeCount || 0 }}</span>
          </div>
          
          <div v-if="canEdit" class="interaction-btn" @click="handleRecommend($event, work.id)">
            <i :class="['iconfont', work.recommendWeight > 0 ? 'icon-xingxingtuijian1' : 'icon--xingxingtuijian']"></i>
          </div>
        </div>
      </div>
      
      <!-- 作品信息 -->
      <div class="work-info">
        <div class="work-header">
          <h3 @click="goToDetail(work.id)">
            {{ work.name }}
            <a 
              v-if="work.link && work.link.trim()" 
              :href="work.link" 
              target="_blank" 
              rel="noopener noreferrer"
              class="shop-link"
              @click.stop>
              <i class="iconfont icon-gouwu1"></i>
            </a>
          </h3>
        </div>
        <div class="tags">
          <span 
            v-for="tag in work.tags" 
            :key="tag" 
            class="tag"
            :style="getWorkTagStyle(tag)"
            @click.prevent="handleTagClick(tag)">
            {{ tag }}
          </span>
        </div>
        <div class="update-time">
          <span>更新时间: {{ formatDate(work.updatedAt) }}</span>
          <!-- 操作按钮 -->
          <div class="actions" v-if="(showEditActions || showRemoveFromSet) && canEdit">
            <button v-if="showEditActions" @click="handleEdit(work)"><i class="iconfont icon-bianji"></i></button>
            <button v-if="showEditActions" @click="handleDelete(work.id)"><i class="iconfont icon-shanchu"></i></button>
            <button v-if="showRemoveFromSet" @click="handleRemoveFromSet($event, work.id)" title="从合集移出" class="remove-btn">
              X
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  aspect-ratio: 4/3;
  overflow: hidden;
  cursor: pointer;
  position: relative;
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
  display: flex;
  align-items: center;
  gap: 8px;
}

.shop-link {
  color: #499e8d;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: transform 0.2s ease, color 0.2s ease;
  flex-shrink: 0;
  margin-left: 4px;
  padding: 0;
}

.shop-link:hover {
  transform: scale(1.2);
  color: #ff6b6b;
}

.shop-link .iconfont {
  font-size: 1.1rem;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 4px 0;
}

.tag {
  padding-right: 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  height: 20px;
}

.tag:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.update-time {
  font-size: 12px;
  color: #999;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actions {
  display: flex;
}

.actions button {
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.actions button:hover {
  border: 1px dashed #ddd;
}

.remove-btn {
  color: #ff6b6b;
}

.remove-btn:hover {
  color: #e53935;
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

.interaction-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 8px 12px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
}

.interaction-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: white;
  padding: 5px;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.interaction-btn i {
  font-size: 1.2rem;
}

.interaction-btn i.icon-dianzan {
  color: #e53935;
}

.interaction-btn i.icon-xingxingtuijian1 {
  color: #ffc107;
}

/* 置顶按钮样式 */
.top-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  cursor: pointer;
  z-index: 3;
  transition: all 0.3s ease;
}

.top-btn:hover {
  transform: scale(1.1);
}

.top-btn i {
  font-size: 1.2rem;
  color: white;
  transition: opacity 0.3s ease;
}

.top-btn i.icon-zhiding2 {
  opacity: 0.5;
}

.top-btn i.icon-zhiding1 {
  color: #ffc107;
  opacity: 1;
}

@media (max-width: 768px) {
  .work-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  }
}
</style>

