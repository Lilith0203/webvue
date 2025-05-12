<script setup>
import { ref, onMounted, computed } from 'vue'
import { Calendar } from 'v-calendar'
import axios from '../api' // Assuming you have an axios instance configured
import { useRouter } from 'vue-router'
import 'v-calendar/style.css'

const router = useRouter()
const plans = ref([])
const loading = ref(false)
const error = ref(null)
const selectedDate = ref(new Date())

// Fetch plan data
const fetchPlans = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await axios.get('/plans', {
      params: {
        page: 1,
        size: 100 // 获取更多数据以显示在日历上
      }
    })
    plans.value = response.data.items || []
  } catch (err) {
    error.value = "获取计划失败：" + err.message
    console.error('Fetch plans error:', err)
  } finally {
    loading.value = false
  }
}

// Calculate calendar attributes
const calendarAttributes = computed(() => {
  // 确保基础属性数组始终存在
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

  // 确保 plans.value 存在
  if (!plans.value || !Array.isArray(plans.value)) {
    return baseAttributes
  }

  // 过滤并映射有效的计划
  const planAttributes = plans.value
    .filter(plan => {
      // 更严格的验证
      return plan 
        && typeof plan === 'object'
        && plan.id 
        && plan.title 
        && plan.startDate
        && !isNaN(new Date(plan.startDate).getTime())
    })
    .map(plan => {
      try {
        return {
          key: `plan-${plan.id}`,
          highlight: {
            color: getStatusColor(plan.status || ''),
            fillMode: 'light',
          },
          dates: {
            start: new Date(plan.startDate),
            end: plan.endDate && !isNaN(new Date(plan.endDate).getTime())
              ? new Date(plan.endDate)
              : new Date(plan.startDate)
          },
          customData: {
            ...plan,
            // 确保必要的字段存在
            title: plan.title || '未命名计划',
            status: plan.status || '未知状态'
          }
        }
      } catch (error) {
        console.error('Error processing plan:', plan, error)
        return null
      }
    })
    .filter(Boolean) // 移除无效的计划

  return [...baseAttributes, ...planAttributes]
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
                >
                  <div class="plan-title">{{ attr.customData.title }}</div>
                  <div 
                    v-if="attr.customData.status"
                    class="plan-status" 
                    :style="{ backgroundColor: getStatusColor(attr.customData.status) }"
                  >
                    {{ attr.customData.status }}
                  </div>
                </div>
              </template>
            </div>
            <div v-else class="day-plans empty">
              <!-- 可以添加一些视觉提示，比如一个小的点或留白 -->
            </div>
          </div>
        </template>
      </Calendar>
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

.plan-status {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  color: white;
  font-size: 0.8rem;
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
  display: flex;
  gap: 10px;
  padding: 10px;
  background: var(--color-background);
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.2s;
}

.plan-item:hover {
  transform: translateX(5px);
}

.plan-content {
  flex: 1;
}

.plan-content h5 {
  margin: 0 0 5px 0;
  font-size: 0.9rem;
  color: var(--color-heading);
}

.plan-content p {
  margin: 0 0 5px 0;
  font-size: 0.8rem;
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

/* 日历单元格样式 */
:deep(.vc-day-content) {
  height: 100%;
  padding: 2px;
}

.day-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.day-number {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
  text-align: right;
  padding: 2px 4px;
  margin-bottom: 2px;
}

.day-plans {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  max-height: 75px; /* 调整计划列表最大高度 */
  padding-right: 2px;
}

.day-plans::-webkit-scrollbar {
  width: 4px;
}

.day-plans::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 2px;
}

.plan-item {
  padding: 4px 6px;
  border-radius: 4px;
  background: var(--color-background-mute);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.plan-item:hover {
  transform: translateY(-1px);
  border-color: var(--color-border);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.plan-title {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.plan-status {
  font-size: 0.7rem;
  padding: 1px 4px;
  border-radius: 3px;
  color: white;
  text-align: center;
  display: inline-block;
  min-width: 40px;
}

/* 今天的高亮样式 */
:deep(.vc-day.is-today) {
  background-color: rgba(33, 150, 243, 0.05);
}

:deep(.vc-day.is-today .day-number) {
  color: #2196F3;
  font-weight: 600;
}

/* 空状态样式 */
.day-plans.empty {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-light);
  font-size: 0.8rem;
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
  position: relative; /* 添加相对定位 */
  margin-top: 0px;
}

:deep(.vc-title) {
  background-color: transparent;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-heading);
  white-space: nowrap;
  padding: 0 40px; /* 增加两侧padding，为导航按钮留出空间 */
  text-align: center;
  width: 100%; /* 确保标题占满容器宽度 */
}

/* 添加导航按钮样式 */
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
}

:deep(.vc-nav-arrow:hover) {
  background-color: var(--color-background-mute);
}

:deep(.vc-nav-arrow.is-left) {
  left: 10px;
}

:deep(.vc-nav-arrow.is-right) {
  right: 10px;
}

/* 日历网格样式 */
:deep(.vc-weeks) {
  padding: 0 12px; /* 增加网格padding */
}

:deep(.vc-weekday) {
  font-weight: 500;
  color: var(--color-text);
  padding: 6px 0; /* 增加星期行padding */
  font-size: 0.8rem; /* 增大星期字体 */
}

:deep(.vc-day) {
  padding: 4px;
  border: 1px solid var(--color-border);
  transition: background-color 0.2s;
}

:deep(.vc-day:hover) {
  background-color: var(--color-background-mute);
}

:deep(.vc-day.is-not-in-month) {
  background-color: var(--color-background-mute);
  opacity: 0.6;
}

/* 日期单元格内容样式 */
.day-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.day-number {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
  text-align: right;
  padding: 2px 4px;
  margin-bottom: 2px;
}

/* 今天的高亮样式 */
:deep(.vc-day.is-today) {
  background-color: rgba(33, 150, 243, 0.05);
}

:deep(.vc-day.is-today .day-number) {
  color: #2196F3;
  font-weight: 600;
}

/* 计划项样式优化 */
.day-plans {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  max-height: 75px; /* 调整计划列表最大高度 */
  padding-right: 2px;
}

.day-plans::-webkit-scrollbar {
  width: 4px;
}

.day-plans::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 2px;
}

.plan-item {
  padding: 4px 6px;
  border-radius: 4px;
  background: var(--color-background-mute);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.plan-item:hover {
  transform: translateY(-1px);
  border-color: var(--color-border);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.plan-title {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.plan-status {
  font-size: 0.7rem;
  padding: 1px 4px;
  border-radius: 3px;
  color: white;
  text-align: center;
  display: inline-block;
  min-width: 40px;
}

/* 空状态样式 */
.day-plans.empty {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-light);
  font-size: 0.8rem;
}
</style>
