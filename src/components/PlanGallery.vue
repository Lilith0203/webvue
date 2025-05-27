<script setup>
import { ref, onMounted, computed } from 'vue'
import { Calendar } from 'v-calendar'
import axios from '../api' // Assuming you have an axios instance configured
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import 'v-calendar/style.css'

// 获取认证状态
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const plans = ref([])
const loading = ref(false)
const error = ref(null)
const selectedDate = ref(new Date())

// 编辑相关状态
const showEditModal = ref(false)
const editingPlan = ref({
  id: null,
  title: '',
  description: '',
  status: '',
  startDate: '',
  endDate: '',
  link: '',
  sort: 0
})
const isNewPlan = ref(true)

// 计算属性 - 登录状态
const isLoggedIn = computed(() => {
  return authStore.isAuthenticated
})

// Fetch plan data
const fetchPlans = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await axios.get('/plans', {
      params: {
        page: 1,
        size: 100
      }
    })
    // 确保日期格式正确
    plans.value = (response.data.items || []).map(plan => ({
      ...plan,
      startDate: plan.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : null,
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().split('T')[0] : null
    }))
  } catch (err) {
    error.value = "获取计划失败：" + err.message
    console.error('Fetch plans error:', err)
  } finally {
    loading.value = false
  }
}

// 打开创建计划模态框
const openCreateModal = (date) => {
  if (!isLoggedIn.value) {
    alert('请先登录')
    return
  }

  isNewPlan.value = true
  editingPlan.value = {
    id: null,
    title: '',
    description: '',
    status: '进行中',
    startDate: date.toISOString().split('T')[0],
    endDate: date.toISOString().split('T')[0],
    link: '',
    sort: 0
  }
  showEditModal.value = true
}

// 打开编辑计划模态框
const openEditModal = (plan) => {
  if (!isLoggedIn.value) {
    alert('请先登录')
    return
  }

  isNewPlan.value = false
  editingPlan.value = { ...plan }
  showEditModal.value = true
}

// 保存计划
const savePlan = async () => {
  if (!editingPlan.value.title) {
    error.value = '请输入计划标题'
    return
  }

  try {
    loading.value = true
    error.value = null
    
    if (isNewPlan.value) {
      // 创建新计划
      await axios.post('/planAdd', editingPlan.value)
    } else {
      // 更新计划
      await axios.post('/plan/edit', editingPlan.value)
    }
    
    showEditModal.value = false
    await fetchPlans() // 刷新计划列表
  } catch (err) {
    error.value = `计划${isNewPlan.value ? '创建' : '更新'}失败: ${err.message}`
    console.error('Save plan error:', err)
  } finally {
    loading.value = false
  }
}

// 删除计划
const deletePlan = async () => {
  if (!isLoggedIn.value) {
    alert('请先登录')
    return
  }

  if (!editingPlan.value.id || !confirm('确定要删除该计划吗？')) {
    return
  }

  try {
    loading.value = true
    error.value = null
    
    await axios.post('/plan/delete', { id: editingPlan.value.id })
    
    showEditModal.value = false
    await fetchPlans() // 刷新计划列表
  } catch (err) {
    error.value = `删除计划失败: ${err.message}`
    console.error('Delete plan error:', err)
  } finally {
    loading.value = false
  }
}

// Calculate calendar attributes
const calendarAttributes = computed(() => {
  const baseAttributes = [
    {
      key: 'today',
      highlight: {
        color: 'blue',
        fillMode: 'light',
      },
      dates: new Date(),
    }
  ]

  if (!plans.value || !Array.isArray(plans.value)) {
    return baseAttributes
  }

  // 创建一个 Set 来存储有计划的日期
  const datesWithEvents = new Set()

  const planAttributes = plans.value
    .filter(plan => {
      if (!plan || !plan.startDate) return false
      const startDate = new Date(plan.startDate)
      if (isNaN(startDate.getTime())) return false
      
      // 记录有计划的日期
      datesWithEvents.add(startDate.toISOString().split('T')[0])
      if (plan.endDate) {
        const endDate = new Date(plan.endDate)
        if (!isNaN(endDate.getTime())) {
          datesWithEvents.add(endDate.toISOString().split('T')[0])
        }
      }
      return true
    })
    .map(plan => {
      try {
        const startDate = new Date(plan.startDate)
        const endDate = plan.endDate ? new Date(plan.endDate) : startDate
        
        return {
          key: `plan-${plan.id}`,
          highlight: {
            color: getStatusColor(plan.status || ''),
            fillMode: 'light',
          },
          dates: {
            start: startDate,
            end: endDate
          },
          customData: {
            ...plan,
            title: plan.title || '未命名计划',
            status: plan.status || '未知状态'
          }
        }
      } catch (error) {
        console.error('Error processing plan:', plan, error)
        return null
      }
    })
    .filter(Boolean)

  // 为有计划的日期添加 has-events 类
  const dateAttributes = Array.from(datesWithEvents).map(date => ({
    key: `has-events-${date}`,
    dates: new Date(date),
    class: 'has-events'
  }))

  return [...baseAttributes, ...dateAttributes, ...planAttributes]
})

// Get status color based on plan status
const getStatusColor = (status) => {
  switch (status) {
    case '进行中':
      return '#2196F3' // blue
    case '已完成':
      return '#4CAF50' // green
    case '已取消':
      return '#F44336' // red
    default:
      return '#9E9E9E' // gray
  }
}

// Get selected date plans
const selectedDatePlans = computed(() => {
  const date = selectedDate.value
  return plans.value.filter(plan => {
    const startDate = new Date(plan.startDate)
    const endDate = plan.endDate ? new Date(plan.endDate) : new Date(plan.startDate)
    return date >= startDate && date <= endDate
  })
})

// Handle day click
const onDayClick = (day) => {
  selectedDate.value = day.date
  if (isLoggedIn.value) {
    openCreateModal(day.date)
  }
}

// 点击计划项
const onPlanClick = (plan) => {
  if (isLoggedIn.value) {
    openEditModal(plan)
  }
}

onMounted(() => {
  fetchPlans()
})
</script>

<template>
  <div class="plan-gallery">
    <div class="gallery-title">
      <h3>
        <i class="iconfont icon-huawen2"></i> <!-- Use appropriate icons -->
        <span>近期计划</span>
        <i class="iconfont icon-huawen1"></i> <!-- Use appropriate icons -->
      </h3>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="!loading && !error" class="calendar-container">
      <Calendar
        v-model="selectedDate"
        :attributes="calendarAttributes"
        is-expanded
        trim-weeks
        title-position="center"
        @dayclick="onDayClick"
        class="calendar"
      >
        <!-- 自定义日期单元格内容 -->
        <template #day-content="{ day, attributes }">
          <div class="day-content">
            <span class="day-number">{{ day.day }}</span>
            <div v-if="attributes && attributes.length > 0" class="day-plans">
              <template v-for="attr in attributes" :key="attr.key">
                <div 
                  v-if="attr && attr.customData && attr.customData.title"
                  class="plan-item"
                  @click.stop="onPlanClick(attr.customData)"
                  :title="attr.customData.title"
                >
                  <div class="plan-title">{{ attr.customData.title }}</div>
                  
                </div>
              </template>
            </div>
            <div v-else class="day-plans empty"></div>
          </div>
        </template>
      </Calendar>

      <!-- 添加按钮 - 仅登录状态显示 -->
      <div v-if="isLoggedIn" class="action-buttons">
        <button @click="openCreateModal(selectedDate)" class="add-plan-btn">
          <i class="iconfont icon-add"></i> 添加计划
        </button>
      </div>
    </div>

    <!-- 编辑计划模态框 -->
    <div v-if="showEditModal" class="modal-overlay" @click="showEditModal = false">
      <div class="modal-content" @click.stop>
        <h3>{{ isNewPlan ? '创建计划' : '编辑计划' }}</h3>
        
        <div class="form-group">
          <label for="plan-title">标题</label>
          <input id="plan-title" v-model="editingPlan.title" type="text" placeholder="计划标题" required>
        </div>
        
        <div class="form-group">
          <label for="plan-description">描述</label>
          <textarea id="plan-description" v-model="editingPlan.description" placeholder="计划描述"></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group half">
            <label for="plan-status">状态</label>
            <select id="plan-status" v-model="editingPlan.status">
              <option value="">未设置</option>
              <option value="进行中">进行中</option>
              <option value="已完成">已完成</option>
              <option value="已取消">已取消</option>
            </select>
          </div>
        
        </div>
        
        <div class="form-row">
          <div class="form-group half">
            <label for="plan-start-date">开始日期</label>
            <input id="plan-start-date" v-model="editingPlan.startDate" type="date" required>
          </div>
          
          <div class="form-group half">
            <label for="plan-end-date">结束日期</label>
            <input id="plan-end-date" v-model="editingPlan.endDate" type="date">
          </div>
        </div>
        
        <div class="form-group">
          <label for="plan-link">相关链接</label>
          <input id="plan-link" v-model="editingPlan.link" type="text" placeholder="相关链接">
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div class="modal-actions">
          <button 
            v-if="!isNewPlan" 
            @click="deletePlan" 
            class="delete-btn"
          >
            删除
          </button>
          <button @click="showEditModal = false" class="cancel-btn">取消</button>
          <button @click="savePlan" class="save-btn">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Reuse styles from WorkGallery or ArticleGallery, adjust as needed */
.plan-gallery {
  margin: 0.5rem 0 0.4rem 0;
  padding: 10px 0; /* Add padding */
}

.gallery-title {
  margin-bottom: 10px; /* Increased margin */
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

.gallery-title h3 {
  padding: 0 36px;
  border-bottom: 1px solid #949494;
  display: inline-flex; /* Ensure icons and text are inline */
  align-items: center;
}

.gallery-title span {
  font-size: 1.1rem;
  color: var(--color-text);
  padding: 0 10px;
  font-weight: bold;
  text-decoration: none; /* Ensure no underline */
}

.gallery-title a:hover {
  color: var(--color-blue);
}

.icon-huawen1, .icon-huawen2 {
  font-size: 1.5rem; /* Or adjust icon size */
  color: var(--color-text);
}

.calendar-container {
  margin: 0 auto;
  max-width: 1200px; /* 增加最大宽度 */
}

.calendar {
  width: 100%;
  background: var(--color-background);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Custom calendar dot style */
:deep(.plan-dot) {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin: 2px;
}

/* Custom popover style */
.plan-popover {
  padding: 8px;
  cursor: pointer;
  min-width: 200px;
}

.plan-popover h4 {
  margin: 0 0 4px 0;
  font-size: 0.9rem;
  color: var(--color-heading);
}

.plan-popover p {
  margin: 0 0 4px 0;
  font-size: 0.8rem;
  color: var(--color-text);
}

.selected-date-plans {
  flex: 1;
  min-width: 300px;
  padding: 15px;
  background: var(--color-background-mute);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.selected-date-plans h4 {
  margin: 0 0 15px 0;
  color: var(--color-heading);
  font-size: 1rem;
}

.plans-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plan-item {
  padding: 2px 4px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%; /* 确保计划项占满容器宽度 */
}

.plan-title {
  font-size: 0.75rem;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  padding: 1px 0;
}

.plan-status {
  font-size: 0.65rem;
  padding: 0 3px;
  border-radius: 2px;
  color: white;
  text-align: center;
  display: inline-block;
  max-width: fit-content;
}

.plan-date {
  font-size: 0.8rem;
  color: var(--color-text-light);
}

.no-plans {
  text-align: center;
  color: var(--color-text-light);
  padding: 20px 0;
}

.more {
  display: block;
  text-align: center;
  margin-top: 20px; /* Space above more link */
}

.more a {
  color: var(--color-blue);
  text-decoration: none;
}

.more a:hover {
  text-decoration: underline;
}

/* Loading, error, empty states */
.loading, .error, .empty-state {
  text-align: center;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}
.error {
  color: #dc3545;
}

/* 日历单元格基础样式 */
:deep(.vc-day) {
  padding: 4px;
  border: 1px solid var(--color-border);
  transition: all 0.2s;
}

/* 日期内容容器 */
.day-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 日期数字样式 */
.day-number {
  font-size: 0.8rem;
  color: var(--color-text);
  text-align: right;
  padding: 2px 4px;
  flex-shrink: 0; /* 防止日期数字被压缩 */
}

/* 计划列表容器 */
.day-plans {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  max-height: 55px; /* 减小最大高度，保持单元格一致性 */
  padding-right: 2px;
  margin-top: 2px;
}

/* 空状态样式 */
.day-plans.empty {
  display: none; /* 完全隐藏空容器 */
}

/* 日历网格样式 */
:deep(.vc-weeks) {
  padding: 0; /* 移除网格padding */
}

:deep(.vc-weekday) {
  padding: 6px 0;
  font-size: 0.8rem;
  font-weight: 500;
}

/* 今天的高亮样式 */
:deep(.vc-day.is-today) {
  background-color: rgba(33, 150, 243, 0.05);
}

:deep(.vc-day.is-today .day-number) {
  color: #2196F3;
  font-weight: 600;
}

/* 日历头部样式 */
:deep(.vc-container) {
  --vc-accent-50: #e3f2fd;
  --vc-accent-100: #bbdefb;
  --vc-accent-200: #90caf9;
  --vc-accent-300: #64b5f6;
  --vc-accent-400: #42a5f5;
  --vc-accent-500: #2196f3;
  --vc-accent-600: #1e88e5;
  --vc-accent-700: #1976d2;
  --vc-accent-800: #1565c0;
  --vc-accent-900: #0d47a1;
  
  border: none;
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
}

:deep(.vc-header) {
  background-color: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-top: 0px;
  padding: 15px 0; /* 增加上下padding */
  min-height: 60px; /* 增加最小高度 */
  width: 100%;
}

:deep(.vc-title) {
  background-color: transparent;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-heading);
  white-space: nowrap;
  padding: 0 60px; /* 增加两侧padding，为导航按钮留出更多空间 */
  text-align: center;
  width: 100%; /* 确保标题占满容器宽度 */
}

/* 调整导航按钮位置 */
:deep(.vc-nav-arrow) {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text);
  border-radius: 50%;
  transition: background-color 0.2s;
  z-index: 10; /* 确保箭头在最上层 */
}

:deep(.vc-nav-arrow.is-left) {
  left: 20px; /* 调整左侧箭头位置，移得更远 */
}

:deep(.vc-nav-arrow.is-right) {
  right: 20px; /* 调整右侧箭头位置，移得更远 */
}

:deep(.vc-highlight) {
  width: 20px;
  height: 20px;
}

/* 计划项样式优化 */
.day-plans::-webkit-scrollbar {
  width: 4px;
}

.day-plans::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 2px;
}

/* 添加按钮样式 */
.action-buttons {
  margin-top: 15px;
  display: flex;
  justify-content: flex-end;
}

.add-plan-btn {
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 2px 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  transition: background-color 0.2s;
}

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: var(--color-background);
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: var(--color-heading);
  font-size: 1rem;
  text-align: center;
}

.form-group {
  margin-bottom: 15px;
}

.form-row {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.form-group.half {
  flex: 1;
}

label {
  display: block;
  margin-bottom: 5px;
  font-size: 0.9rem;
  color: var(--color-text);
  font-weight: 500;
}

input[type="text"],
input[type="date"],
input[type="number"],
textarea,
select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background-color: var(--color-background);
  color: var(--color-text);
  font-size: 0.9rem;
}

textarea {
  min-height: 80px;
  resize: vertical;
}

.error-message {
  color: #f44336;
  margin-top: 10px;
  font-size: 0.85rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.save-btn,
.cancel-btn,
.delete-btn {
  padding: 5px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.2s;
}

.save-btn {
  background-color: var(--color-blue);
  color: white;
}

.cancel-btn {
  background-color: var(--color-background-mute);
  color: var(--color-text);
}

.delete-btn {
  background-color: #d32f2f;
  color: white;
  margin-right: auto; /* 推到左侧 */
}

.delete-btn:hover {
  background-color: #f44336;
}

/* 修改月份选择弹出层样式 */
:deep(.vc-nav-popover-container) {
  padding: 8px !important;
}

:deep(.vc-nav-container) {
  width: 226px !important; /* 增加宽度 */
}

:deep(.vc-nav-items) {
  grid-template-columns: repeat(3, 1fr) !important; /* 改为3列布局 */
  gap: 8px !important;
}

:deep(.vc-nav-item) {
  padding: 4px 6px !important;
  font-size: 0.8rem !important;
  min-width: 70px !important; /* 确保每个月份项有足够宽度 */
  font-weight: normal;
  background-color: #fff;
}

:deep(.vc-nav-item.is-active) {
  background-color: var(--vc-nav-item-active-bg);
}

/* 调整导航箭头位置 */
:deep(.vc-nav-header) {
  position: relative;
  padding: 5px 0;
  margin-bottom: 8px;
}

:deep(.vc-nav-header .vc-nav-arrow) {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

:deep(.vc-nav-header .vc-nav-arrow.is-left) {
  left: 0px;
}

:deep(.vc-nav-header .vc-nav-arrow.is-right) {
  right: 0px;
}

:deep(.vc-nav-header .vc-nav-title) {
  margin: 0 40px; /* 为左右箭头预留空间 */
  width: auto;
  font-weight: normal;
  background: transparent;
}

</style>
