<script setup>
import axios from '../api'
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter, useRoute } from 'vue-router'

import ImagePreview from '../components/ImagePreview.vue'
import Announcement from '../components/Announcement.vue'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// 响应式状态
const storySets = ref([])
const stories = ref([])
const activeSetId = ref(null)
const activeChildId = ref(null)
const loading = ref(false)
const error = ref(null)
const showAddSetModal = ref(false)
const showEditSetModal = ref(false)
const newSet = ref({
  name: '',
  description: '',
  sort: 0,
  parentId: 0,
  cover: '',
  onlineAt: ''
})
const editingSet = ref(null)
const confirmDeleteModal = ref(false)
const setToDelete = ref(null)


// 剧情相关状态
const showAddStoryModal = ref(false)
const showEditStoryModal = ref(false)
const newStory = ref({
  title: '',
  content: '',
  pictures: [],
  link: '',
  onlineAt: '',
  setIds: [],
  isRecommended: false
})
const editingStory = ref(null)
const confirmDeleteStoryModal = ref(false)
const storyToDelete = ref(null)

// 添加一个新的响应式状态来跟踪展开的菜单
const expandedMenus = ref({})

// 添加简略模式状态
const isSimpleMode = ref(false)
// 添加排序方向状态
const sortDirection = ref('DESC')

// 分页相关状态
const currentPage = ref(1)
const pageSize = ref(30)
const totalPages = ref(1)
const totalItems = ref(0)

// 添加搜索关键词状态
const searchKeyword = ref('');

// 添加定制功能相关状态
const showCustomizePanel = ref(false)
const customSetIds = ref(new Set()) // 用户选择的合集ID集合
const isCustomMode = ref(false) // 是否启用定制模式

// 添加跳转页码相关状态和方法
const targetPage = ref('');

// 添加一个新的响应式状态来控制body滚动
const isModalOpen = ref(false)

// 检查菜单是否展开
const isMenuExpanded = (setId) => {
  return expandedMenus.value[setId] === true
}

// 切换菜单展开状态
const toggleMenu = (setId) => {
  expandedMenus.value[setId] = !expandedMenus.value[setId]
}

// 切换简略模式
const toggleSimpleMode = () => {
  isSimpleMode.value = !isSimpleMode.value
}

// 切换排序方向
const toggleSortDirection = () => {
  sortDirection.value = sortDirection.value === 'ASC' ? 'DESC' : 'ASC'
  currentPage.value = 1
  fetchStories() // 切换排序后重新获取数据
}

// 计算属性
const isLoggedIn = computed(() => {
  return authStore.isAuthenticated
})

const rootSets = computed(() => {
  // 确保每个合集都有children属性
  return storySets.value
    .filter(set => set.level === 1 || set.parentId === 0)
    .map(set => {
      if (!set.children) {
        set.children = []
      }
      return set
    })
})

const activeSet = computed(() => {
  if (!activeSetId.value) return null
  return storySets.value.find(set => set.id === activeSetId.value)
})

const getActiveRootSet = () => {
  if (!activeSetId.value) return null
  
  // 首先尝试直接查找当前活动的合集
  let currentSet = storySets.value.find(set => set.id === activeSetId.value)
  
  // 如果找不到，可能是子合集，尝试在所有合集的children中查找
  if (!currentSet) {
    for (const rootSet of storySets.value) {
      if (rootSet.children && rootSet.children.length > 0) {
        const childSet = rootSet.children.find(child => child.id === activeSetId.value)
        if (childSet) {
          // 找到了子合集，返回其父合集
          return rootSet
        }
      }
    }
    return null
  }
  
  // 如果当前合集是子合集(parentId不为0)，找到其父合集
  if (currentSet.parentId !== 0) {
    const parentSet = storySets.value.find(set => set.id === currentSet.parentId)
    if (parentSet) {
      return parentSet
    }
  }
  
  // 如果是根合集，直接返回
  return currentSet
}

// 判断合集是否处于活动状态（包括其子合集）
const isSetActive = (setId) => {
  // 如果当前合集就是活动合集，返回true
  if (activeSetId.value === setId) return true
  
  // 如果有活动的子合集，检查它是否属于当前合集
  if (activeChildId.value) {
    const rootSet = rootSets.value.find(set => set.id === setId)
    if (rootSet && rootSet.children) {
      return rootSet.children.some(child => child.id === activeChildId.value)
    }
  }
  
  return false
}

// 添加缩写映射
const abbreviationMap = {
  '时空中的绘旅人': '绘旅人',
  '世界之外': '世外',
  '光与夜之恋': '光夜',
  '未定事件簿': '未定',
  '恋与深空': '深空'
}

// 获取显示名称（如果是子合集，显示"父合集-子合集"的形式）
const getDisplayName = (setId) => {
  // 获取当前根合集
  const rootSet = rootSets.value.find(set => set.id === setId)
  if (!rootSet) return ''
  
  // 如果当前选中的是子合集，并且这个子合集属于当前根合集
  if (activeChildId.value && rootSet.children && rootSet.children.some(child => child.id === activeChildId.value)) {
    const childSet = rootSet.children.find(child => child.id === activeChildId.value)
    if (childSet) {
      const parentName = abbreviationMap[rootSet.name] || rootSet.name
      const childName = abbreviationMap[childSet.name] || childSet.name
      return `${parentName} - ${childName}`
    }
  }
  
  // 默认显示根合集名称
  return abbreviationMap[rootSet.name] || rootSet.name
}

// 获取全称显示名称（桌面端使用）
const getFullDisplayName = (setId) => {
  // 获取当前根合集
  const rootSet = rootSets.value.find(set => set.id === setId)
  if (!rootSet) return ''
  
  // 如果当前选中的是子合集，并且这个子合集属于当前根合集
  if (activeChildId.value && rootSet.children && rootSet.children.some(child => child.id === activeChildId.value)) {
    const childSet = rootSet.children.find(child => child.id === activeChildId.value)
    if (childSet) {
      return `${rootSet.name} - ${childSet.name}`
    }
  }
  
  // 默认显示根合集名称
  return rootSet.name
}

// 修改选择合集的方法
const selectSet = async (id) => {
  if (activeSetId.value === id) {
    // 如果点击的是当前活动的合集，则切换菜单展开状态
    toggleMenu(id)
    return
  }
  
  activeSetId.value = id
  activeChildId.value = null
  
  // 手动获取故事
  currentPage.value = 1
  await fetchStories()
}

// 选择子合集
const selectChildSet = async (id) => {
  // 先设置activeSetId，这样activeSet计算属性会更新
  activeSetId.value = id
  activeChildId.value = id
  
  // 选择子合集后关闭所有菜单
  Object.keys(expandedMenus.value).forEach(key => {
    expandedMenus.value[key] = false
  })
  
  // 手动获取故事
  currentPage.value = 1
  sessionStorage.setItem('storyActiveSetId', activeSetId.value?.toString() || '')
  sessionStorage.setItem('storyActiveChildId', activeChildId.value?.toString() || '')
  await fetchStories()
}

// 获取剧情合集列表
const fetchStorySets = async () => {
  try {
    const res = await axios.get('/story-sets')
    if (res.data.success) {
      storySets.value = res.data.data
      // 初始化默认选择
      initDefaultSelection()
    } else {
      error.value = res.data.message || '获取剧情合集失败'
    }
  } catch (e) {
    error.value = '获取剧情合集失败'
  }
}

// 获取剧情列表
const fetchStories = async () => {
  if (!activeSetId.value) {
    console.log('fetchStories: activeSetId is null, skipping fetch')
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    
    const response = await axios.get(`/story-sets/${activeSetId.value}`, {
      params: {
        page: currentPage.value,
        size: pageSize.value,
        sortDirection: sortDirection.value,
        keyword: searchKeyword.value // 添加关键词参数
      }
    })
    
    if (response.data.success) {
      stories.value = response.data.data
      totalItems.value = response.data.count
      totalPages.value = response.data.page_all
      currentPage.value = response.data.page_now
    } else {
      error.value = response.data.message || '获取故事失败'
    }
  } catch (err) {
    console.error('获取故事失败:', err)
    error.value = '获取故事失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 打开添加合集模态框
const openAddSetModal = () => {
  showAddSetModal.value = true
  
  // 重置新合集表单，排序默认为0
  newSet.value = {
    name: '',
    description: '',
    sort: 0, // 默认排序为0
    parentId: 0,
    cover: '',
    onlineAt: ''
  }
  
  error.value = null
}

// 关闭添加合集模态框
const closeAddSetModal = () => {
  showAddSetModal.value = false
  error.value = null
}

// 添加剧情合集
const addStorySet = async () => {
  if (!newSet.value.name) {
    error.value = '请输入合集名称'
    return
  }
  
  try {
    loading.value = true
    error.value = null
    
    // 创建合集数据
    const setData = {
      name: newSet.value.name,
      description: newSet.value.description,
      sort: newSet.value.sort, // 使用表单中输入的排序值
      parentId: newSet.value.parentId,
      cover: newSet.value.cover,
      onlineAt: newSet.value.onlineAt
    }
    
    // 发送请求添加合集
    await axios.post('/story-sets', setData)
    
    // 重新获取合集列表
    await fetchStorySets()
    
    // 关闭模态框
    closeAddSetModal()
  } catch (err) {
    error.value = '添加合集失败'
    console.error('添加合集错误:', err)
  } finally {
    loading.value = false
  }
}

// 打开编辑合集模态框
const openEditSetModal = (set) => {
  
  if (!set) {
    // 如果activeSetId存在，尝试直接通过ID查找合集
    if (activeSetId.value) {
      // 修改查找逻辑，递归查找所有合集包括子合集
      const findSet = (sets, id) => {
        for (const set of sets) {
          if (set.id === id) return set;
          if (set.children && set.children.length > 0) {
            const found = findSet(set.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      const currentSet = findSet(storySets.value, activeSetId.value);
      if (currentSet) {
        editingSet.value = JSON.parse(JSON.stringify(currentSet));
        showEditSetModal.value = true;
        error.value = null;
        return;
      }
    }
    return;
  }
  
  // 创建一个深拷贝，避免直接修改原对象
  editingSet.value = JSON.parse(JSON.stringify(set));
  showEditSetModal.value = true;
  error.value = null;
}

// 关闭编辑合集模态框
const closeEditSetModal = () => {
  showEditSetModal.value = false
  editingSet.value = null
  error.value = null
}

// 更新剧情合集
const updateStorySet = async () => {
  if (!editingSet.value || !editingSet.value.name.trim()) {
    error.value = '合集名称不能为空'
    return
  }
  
  try {
    loading.value = true
    
    // 在发送请求前计算层级
    const dataToSend = { ...editingSet.value }
    
    if (dataToSend.parentId === 0) {
      dataToSend.level = 1 // 根合集层级为1
    } else {
      const parentSet = storySets.value.find(set => set?.id === dataToSend.parentId) || null
      dataToSend.level = parentSet ? parentSet.level + 1 : 1
    }
    
    await axios.put(`/story-sets/${dataToSend.id}`, dataToSend)
    
    // 更新合集列表
    await fetchStorySets()
    closeEditSetModal()
    
    // 如果当前选中的是被编辑的合集，重新获取其内容
    if (editingSet.value && activeSetId.value === editingSet.value.id) {
      await fetchStories()
    }
  } catch (err) {
    error.value = '更新剧情合集失败: ' + (err.response?.data?.message || err.message)
    console.error('更新剧情合集错误:', err)
  } finally {
    loading.value = false
  }
}

// 打开删除确认模态框
const openDeleteConfirmModal = (set) => {
  
  if (!set) {
    
    // 如果activeSetId存在，尝试直接通过ID查找合集
    if (activeSetId.value) {
      // 修改查找逻辑，递归查找所有合集包括子合集
      const findSet = (sets, id) => {
        for (const set of sets) {
          if (set.id === id) return set;
          if (set.children && set.children.length > 0) {
            const found = findSet(set.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      const currentSet = findSet(storySets.value, activeSetId.value);
      if (currentSet) {
        setToDelete.value = currentSet;
        confirmDeleteModal.value = true;
        return;
      }
    }
    return;
  }
  
  setToDelete.value = set;
  confirmDeleteModal.value = true;
}

// 关闭删除确认模态框
const closeDeleteConfirmModal = () => {
  confirmDeleteModal.value = false
  setToDelete.value = null
  error.value = null
}

// 删除剧情合集
const deleteStorySet = async () => {
  if (!setToDelete.value) return
  
  try {
    loading.value = true
    
    // 使用POST请求代替DELETE
    await axios.post('/story-sets/delete', {
      id: setToDelete.value.id
    })
    
    // 更新合集列表
    await fetchStorySets()
    closeDeleteConfirmModal()
    
    // 如果删除的是当前选中的合集，选择第一个合集
    if (activeSetId.value === setToDelete.value.id) {
      if (storySets.value.length > 0) {
        selectSet(storySets.value[0].id)
      } else {
        activeSetId.value = null
        stories.value = []
      }
    }
  } catch (err) {
    error.value = '删除剧情合集失败: ' + (err.response?.data?.message || err.message)
    console.error('删除剧情合集错误:', err)
  } finally {
    loading.value = false
  }
}

// 剧情相关方法
// 打开添加剧情模态框
const openAddStoryModal = () => {
  showAddStoryModal.value = true
  isModalOpen.value = true
  document.body.style.overflow = 'hidden' // 禁用背景滚动
  
  newStory.value = {
    title: '',
    content: '',
    pictures: [],
    link: '',
    onlineAt: '',
    setIds: activeSetId.value ? [activeSetId.value] : [], // 默认选中当前合集
    isRecommended: false
  }
  
  error.value = null
}

// 关闭添加剧情模态框
const closeAddStoryModal = () => {
  
  // 先重置表单数据
  newStory.value = {
    title: '',
    content: '',
    pictures: [],
    link: '',
    onlineAt: '',
    setIds: [],
    isRecommended: false
  }
  error.value = null
  
  // 立即关闭模态框
  showAddStoryModal.value = false
  isModalOpen.value = false
  document.body.style.overflow = '' // 恢复背景滚动
}

// 添加剧情
const addStory = async () => {
  if (!newStory.value.title) {
    error.value = '请输入剧情标题'
    return
  }
  
  if (newStory.value.setIds.length === 0) {
    error.value = '请至少选择一个合集'
    return
  }
  
  // 记录当前滚动位置
  const scrollPosition = window.scrollY
  
  try {
    loading.value = true
    error.value = null
    
    // 创建剧情基本信息
    const storyData = {
      title: newStory.value.title,
      content: newStory.value.content || '',
      pictures: newStory.value.pictures || [], // 确保pictures是数组
      link: newStory.value.link || '',
      onlineAt: newStory.value.onlineAt || '',
      setIds: newStory.value.setIds, // 传递所有关联的合集ID
      isRecommended: newStory.value.isRecommended ? 1 : 0
    }
    
    // 发送请求添加剧情
    await axios.post('/stories', storyData)
    
    // 先关闭模态框，再重新获取数据
    closeAddStoryModal()
    
    // 重新获取剧情列表
    await fetchStories()
    
    // 恢复滚动位置
    window.scrollTo({
      top: scrollPosition,
      behavior: 'instant'
    })
  } catch (err) {
    error.value = '添加剧情失败: ' + (err.response?.data?.message || err.message)
    console.error('添加剧情错误:', err)
  } finally {
    loading.value = false
  }
}

// 打开编辑剧情模态框
const openEditStoryModal = async (story) => {
  if (!story) return;
  
  try {
    // 获取剧情详情
    const response = await axios.get(`/stories/${story.id}`);
    const storyDetail = response.data.data;
    
    // 创建编辑对象，从 sets 中提取 setIds
    editingStory.value = {
      id: storyDetail.id,
      title: storyDetail.title,
      content: storyDetail.content || '',
      pictures: storyDetail.pictures || [],
      link: storyDetail.link || '',
      onlineAt: storyDetail.onlineAt || '',
      setIds: storyDetail.sets?.map(set => set.id) || [], // 从 sets 中提取 ID
      isRecommended: storyDetail.isRecommended === 1 || storyDetail.isRecommended === true
    };
    
    showEditStoryModal.value = true;
    isModalOpen.value = true;
    document.body.style.overflow = 'hidden';
    
    // 移动端键盘优化
    if (window.innerWidth <= 768) {
      // 延迟设置，确保模态框已渲染
      setTimeout(() => {
        const modalContent = document.querySelector('.modal-content')
        if (modalContent) {
          modalContent.scrollTop = 0
        }
      }, 100)
    }
    
    error.value = null;
  } catch (err) {
    error.value = '获取剧情详情失败';
    console.error('获取剧情详情错误:', err);
    showEditStoryModal.value = false;
  }
}

// 关闭编辑剧情模态框
const closeEditStoryModal = () => {
  // 先重置编辑状态
  error.value = null
  
  // 立即关闭模态框
  showEditStoryModal.value = false
  isModalOpen.value = false
  document.body.style.overflow = '' // 恢复背景滚动
  editingStory.value = null
}

// 更新剧情
const updateStory = async () => {
  if (!editingStory.value) return
  
  // 记录当前滚动位置
  const scrollPosition = window.scrollY

  // 验证表单
  if (!editingStory.value.title) {
    error.value = '剧情标题不能为空'
    return
  }
  
  try {
    loading.value = true
    
    // 处理日期，确保发送有效的日期或空字符串
    const onlineAt = editingStory.value.onlineAt && editingStory.value.onlineAt.trim() !== '' 
      ? editingStory.value.onlineAt 
      : null;
    
    // 处理pictures字段，确保它是正确的格式
    let pictures = editingStory.value.pictures;
    
    await axios.put(`/stories/${editingStory.value.id}`, {
      title: editingStory.value.title,
      content: editingStory.value.content,
      pictures: pictures,
      link: editingStory.value.link,
      onlineAt: onlineAt,
      setIds: editingStory.value.setIds,
      isRecommended: editingStory.value.isRecommended ? 1 : 0
    })
    
    // 更新剧情列表
    await fetchStories()
    closeEditStoryModal()

    // 恢复滚动位置
    window.scrollTo({
      top: scrollPosition,
      behavior: 'instant' // 使用 'instant' 而不是 'smooth' 以避免看到滚动动画
    })
  } catch (err) {
    error.value = '更新剧情失败: ' + (err.response?.data?.message || err.message)
    console.error('更新剧情错误:', err)
  } finally {
    loading.value = false
  }
}

// 打开删除剧情确认模态框
const openDeleteStoryConfirmModal = (story) => {
  if (!story) return
  storyToDelete.value = story
  confirmDeleteStoryModal.value = true
}

// 关闭删除剧情确认模态框
const closeDeleteStoryConfirmModal = () => {
  confirmDeleteStoryModal.value = false
  storyToDelete.value = null
  error.value = null
}

// 删除剧情
const deleteStory = async () => {
  if (!storyToDelete.value) return
  
  // 记录当前滚动位置
  const scrollPosition = window.scrollY
  
  try {
    loading.value = true
    // 使用POST请求代替DELETE
    const response = await axios.post('/stories/delete', {
      id: storyToDelete.value.id
    })
    
    // 更新剧情列表
    await fetchStories()
    closeDeleteStoryConfirmModal()
    
    // 恢复滚动位置
    window.scrollTo({
      top: scrollPosition,
      behavior: 'instant'
    })
  } catch (err) {
    error.value = '删除剧情失败: ' + (err.response?.data?.message || err.message)
    console.error('删除剧情错误:', err)
  } finally {
    loading.value = false
  }
}

// 选择合集中的"全部"选项
const selectAllInSet = async (rootSetId) => {
  activeSetId.value = rootSetId
  activeChildId.value = null
  
  // 选择"全部"后关闭所有菜单
  Object.keys(expandedMenus.value).forEach(key => {
    expandedMenus.value[key] = false
  })
  
  // 确保重置页码
  currentPage.value = 1
  sessionStorage.setItem('storyActiveSetId', activeSetId.value?.toString() || '')
  sessionStorage.setItem('storyActiveChildId', activeChildId.value?.toString() || '')
  await fetchStories()
}

// 修改 getThumbnailUrl 方法
const getThumbnailUrl = (url, width = 360) => {
  // 处理url为数组的情况
  if (Array.isArray(url)) {
    if (url.length === 0) return '';
    url = url[0];
  }
  
  if (!url) return '';
  
  // 使用更高的锐化参数
  return `${url}?x-oss-process=image`
    + `/resize,w_${width}` // 限制宽度，保持原始比例
}

// 图片预览状态
const previewVisible = ref(false)
const previewImage = ref('')
const previewImages = ref([])
const currentImageIndex = ref(0)
const previewTitle = ref('')

// 显示图片预览
function showImagePreview(pictures, title) {
  // 如果pictures是空数组或undefined，不显示预览
  if (!pictures || (Array.isArray(pictures) && pictures.length === 0)) return;
  
  // 处理pictures为数组的情况
  if (Array.isArray(pictures)) {
    previewImages.value = pictures;
    previewImage.value = pictures[0]; // 设置第一张图片为当前图片
  } else {
    // 如果不是数组，转换为单元素数组
    previewImages.value = [pictures];
    previewImage.value = pictures;
  }
  
  currentImageIndex.value = 0;
  previewVisible.value = true;
  previewTitle.value = title || '图片预览';
}

// 关闭图片预览
function closePreview() {
  previewVisible.value = false;
}

// 查看上一张图片
function prevImage() {
  if (previewImages.value.length <= 1) return;
  currentImageIndex.value = (currentImageIndex.value - 1 + previewImages.value.length) % previewImages.value.length;
  previewImage.value = previewImages.value[currentImageIndex.value];
}

// 查看下一张图片
function nextImage() {
  if (previewImages.value.length <= 1) return;
  currentImageIndex.value = (currentImageIndex.value + 1) % previewImages.value.length;
  previewImage.value = previewImages.value[currentImageIndex.value];
}

// 处理键盘事件
function handleKeyDown(e) {
  if (!previewVisible.value) return;
  
  switch(e.key) {
    case 'Escape':
      closePreview();
      break;
    case 'ArrowLeft':
      prevImage();
      break;
    case 'ArrowRight':
      nextImage();
      break;
  }
}

onUnmounted(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', handleKeyDown);
})

// 修改图片上传相关方法
const handleImageUpload = async (event) => {
  const files = event.target.files
  if (!files.length) return
  
  await uploadFiles(files, 'new')
}

const handleDrop = async (event) => {
  const files = Array.from(event.dataTransfer.files)
    .filter(file => file.type.startsWith('image/'))
  await uploadFiles(files, 'new')
}

const handleEditImageUpload = async (event) => {
  const files = event.target.files
  if (!files.length) return
  
  await uploadFiles(files, 'edit')
}

const handleEditDrop = async (event) => {
  const files = Array.from(event.dataTransfer.files)
    .filter(file => file.type.startsWith('image/'))
  await uploadFiles(files, 'edit')
}

const uploadFiles = async (files, mode) => {
  try {
    for (let file of files) {
      let upload = new FormData()
      upload.append('file', file)
      upload.append('folder', 'stories')
      
      let response = await axios.post('/upload', upload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
      })
      
      // 解析 URL
      const urlObj = new URL(response.data.url)
      // 移除签名相关参数
      const paramsToRemove = ['Expires', 'OSSAccessKeyId', 'Signature', 'security-token', 'x-oss-process']
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param))
      
      const cleanUrl = urlObj.toString();
      
      // 根据模式更新不同的对象
      if (mode === 'new') {
        // 确保newStory.pictures是数组
        if (!Array.isArray(newStory.value.pictures)) {
          newStory.value.pictures = [];
        }
        newStory.value.pictures.push(cleanUrl);
      } else {
        // 确保editingStory.pictures是数组
        if (!Array.isArray(editingStory.value.pictures)) {
          editingStory.value.pictures = [];
        }
        editingStory.value.pictures.push(cleanUrl);
      }
    }
  } catch (error) {
    console.error('上传图片失败:', error)
    this.error = '上传图片失败'
  }
}

// 移除单张图片
const removePicture = (index) => {
  if (Array.isArray(newStory.value.pictures)) {
    if (index !== undefined) {
      newStory.value.pictures.splice(index, 1)
    } else {
      newStory.value.pictures = []
    }
  } else {
    newStory.value.pictures = []
  }
}

// 移除单张编辑中的图片
const removeEditPicture = (index) => {
  if (Array.isArray(editingStory.value.pictures)) {
    if (index !== undefined) {
      editingStory.value.pictures.splice(index, 1)
    } else {
      editingStory.value.pictures = []
    }
  } else {
    editingStory.value.pictures = []
  }
}

// 切换页码
const changePage = (page) => {
  currentPage.value = page
  fetchStories()
}

// 处理搜索
const handleSearch = () => {
  currentPage.value = 1; // 重置到第一页
  fetchStories();
}

// 生命周期钩子
onMounted(() => {
  // 添加键盘事件监听器
  window.addEventListener('keydown', handleKeyDown)
  
  // 初始化定制功能设置
  initCustomizeSettings()
  
  // 检查是否是从详情页返回
  const isFromDetail = route.query.from === 'detail'
  
  // 首先获取所有剧情合集
  fetchStorySets().then(() => {
    if (isFromDetail) {
      // 从详情页返回，恢复所有状态
      const savedSetId = sessionStorage.getItem('storyActiveSetId')
      const savedChildId = sessionStorage.getItem('storyActiveChildId')
      const savedPage = sessionStorage.getItem('storyCurrentPage')
      const savedKeyword = sessionStorage.getItem('storySearchKeyword')
      const savedSortDirection = sessionStorage.getItem('storySortDirection')
      const savedSimpleMode = sessionStorage.getItem('storyIsSimpleMode')
      
      // 恢复合集状态
      if (savedSetId && storySets.value.length > 0) {
        activeSetId.value = parseInt(savedSetId)
        if (savedChildId) {
          activeChildId.value = parseInt(savedChildId)
        }
      } else {
        // 如果读不到已选合集信息，默认选择第一个合集
        if (storySets.value.length > 0) {
          activeSetId.value = storySets.value[0].id
        }
      }
      
      // 恢复其他状态
      if (savedPage) {
        currentPage.value = parseInt(savedPage)
      }
      if (savedKeyword) {
         searchKeyword.value = savedKeyword
      }
      if (savedSortDirection) {
        sortDirection.value = savedSortDirection
      }
      if (savedSimpleMode) {
        isSimpleMode.value = savedSimpleMode === 'true'
      }

      // 使用恢复的状态获取剧情
      fetchStories().then(() => {
          // 剧情加载后恢复滚动位置
          const savedScrollPosition = sessionStorage.getItem('storyListScrollPosition')
          if (savedScrollPosition) {
            setTimeout(() => {
              window.scrollTo({
                top: parseInt(savedScrollPosition),
                behavior: 'instant'
              })
              // 恢复后清除保存的滚动位置
              sessionStorage.removeItem('storyListScrollPosition')
            }, 100)
          }
      })
    } else {
      // 正常访问页面，优先恢复上次选择的合集
      const savedSetId = sessionStorage.getItem('storyActiveSetId')
      const savedChildId = sessionStorage.getItem('storyActiveChildId')
      
      if (savedSetId && storySets.value.length > 0) {
        // 有保存的合集状态，恢复它
        activeSetId.value = parseInt(savedSetId)
        if (savedChildId) {
          activeChildId.value = parseInt(savedChildId)
        }
        fetchStories()
      } else {
        // 没有保存的状态，使用默认行为（第一个合集）
        if (storySets.value.length > 0) {
          activeSetId.value = storySets.value[0].id
          fetchStories()
        }
      }
    }
  })
})

// 格式化故事标题，使方括号内的内容高亮显示
const formatStoryTitle = (title) => {
  if (!title) return '';
  
  // 使用正则表达式匹配方括号内的内容
  return title.replace(/\[(.*?)\]/g, '<span class="highlight-text">[$1]</span>');
}

// 格式化剧情内容，将换行符转换为<p>标签，将链接格式转换为HTML链接
const formatStoryContent = (content) => {
  if (!content) return '';
  
  // 将内容分割成段落
  const paragraphs = content.split('\n').filter(line => line.trim() !== '');
  
  // 处理每个段落，转换链接格式
  return paragraphs.map(paragraph => {
    // 转换链接格式 [文本](链接)
    const withLinks = paragraph.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="story-link">$1</a>');
    return `<p>${withLinks}</p>`;
  }).join('');
}

// 添加清除搜索的方法
const clearSearch = () => {
  searchKeyword.value = '';
  fetchStories();
}

// 添加拖拽相关的方法
const dragStart = (e, index, mode) => {
  e.dataTransfer.setData('text/plain', index);
  e.dataTransfer.effectAllowed = 'move';
}

const dragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

const drop = (e, targetIndex, mode) => {
  e.preventDefault();
  const sourceIndex = e.dataTransfer.getData('text/plain');
  
  // 根据模式选择要操作的数组
  const pictures = mode === 'new' ? newStory.value.pictures : editingStory.value.pictures;
  
  // 移动元素
  const [movedItem] = pictures.splice(sourceIndex, 1);
  pictures.splice(targetIndex, 0, movedItem);
}

// 处理跳转页码
const goToPage = () => {
  if (!targetPage.value) return;
  
  const pageNum = parseInt(targetPage.value);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages.value) {
    // 页码无效
    return;
  }
  
  // 跳转到指定页码
  currentPage.value = pageNum;
  fetchStories();
  // 清空输入框
  targetPage.value = '';
}

// 添加导航到剧情详情的函数
const navigateToStoryDetail = (storyId) => {
  // 导航前保存当前状态和滚动位置
  sessionStorage.setItem('storyActiveSetId', activeSetId.value?.toString() || '')
  sessionStorage.setItem('storyActiveChildId', activeChildId.value?.toString() || '')
  sessionStorage.setItem('storyCurrentPage', currentPage.value.toString())
  sessionStorage.setItem('storySearchKeyword', searchKeyword.value || '')
  sessionStorage.setItem('storySortDirection', sortDirection.value)
  sessionStorage.setItem('storyIsSimpleMode', isSimpleMode.value.toString())
  sessionStorage.setItem('storyListScrollPosition', window.scrollY.toString())  // 保存滚动位置
  
  // 传递当前选中的合集ID和排序方向
  const currentSetId = activeChildId.value || activeSetId.value
  router.push(`/story/${storyId}?from=list&setId=${currentSetId}&sortDirection=${sortDirection.value}`)
}

const showCustomTooltip = (event, content) => {
  // 检查文本中是否包含链接格式 [文本](链接)
  if (content.includes('[') && content.includes('](') && content.includes(')')) {
    // 如果包含链接，不显示tooltip，让链接正常工作
    return;
  }
  
  // 如果已存在并且点击的是同一个元素，则移除
  const existingTooltip = document.querySelector('.custom-tooltip');
  if (existingTooltip) {
    // 判断是否点在同一个元素上
    if (existingTooltip.__owner === event.target) {
      existingTooltip.remove();
      return;
    } else {
      existingTooltip.remove();
    }
  }

  // 创建tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  tooltip.textContent = content;
  tooltip.style.position = 'absolute';
  tooltip.style.background = 'rgba(0,0,0,0.85)';
  tooltip.style.color = '#fff';
  tooltip.style.padding = '8px 12px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '14px';
  tooltip.style.lineHeight = '1.5';
  tooltip.style.whiteSpace = 'pre-wrap';
  tooltip.style.zIndex = 9999;
  tooltip.style.maxWidth = '80vw';

  // 定位到点击位置
  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = rect.left + window.scrollX + 'px';
  tooltip.style.top = rect.bottom + window.scrollY + 4 + 'px';

  // 记录归属元素
  tooltip.__owner = event.target;

  document.body.appendChild(tooltip);

  // 点击其它地方关闭
  const removeTooltip = (e) => {
    if (!tooltip.contains(e.target) && e.target !== event.target) {
      tooltip.remove();
      document.removeEventListener('click', removeTooltip, true);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', removeTooltip, true);
  }, 0);
};

// 打开复制剧情模态框
const openCopyStoryModal = async (story) => {
  if (!story) return;
  
  try {
    // 获取剧情详情
    const response = await axios.get(`/stories/${story.id}`);
    const storyDetail = response.data.data;
    
    // 打开新建模态框并预填充内容
    showAddStoryModal.value = true;
    isModalOpen.value = true;
    document.body.style.overflow = 'hidden';
    
    newStory.value = {
      title: storyDetail.title,
      content: storyDetail.content || '',
      pictures: storyDetail.pictures || [],
      link: storyDetail.link || '',
      onlineAt: storyDetail.onlineAt || '',
      setIds: storyDetail.sets?.map(set => set.id) || (activeSetId.value ? [activeSetId.value] : []),
      isRecommended: false // 复制的剧情默认不推荐
    };
    
    error.value = null;
  } catch (err) {
    error.value = '获取剧情详情失败';
    console.error('获取剧情详情错误:', err);
  }
}

// 初始化定制功能设置
const initCustomizeSettings = () => {
  // 从localStorage加载用户选择的合集
  const savedCustomSetIds = localStorage.getItem('storyCustomSetIds')
  if (savedCustomSetIds) {
    try {
      const ids = JSON.parse(savedCustomSetIds)
      customSetIds.value = new Set(ids)
      isCustomMode.value = true
    } catch (e) {
      console.error('解析保存的定制设置失败:', e)
    }
  }
  // 如果没有保存的设置，默认全部选择（在storySets加载后设置）
}

// 初始化默认选择（在storySets加载完成后调用）
const initDefaultSelection = () => {
  if (storySets.value.length > 0 && customSetIds.value.size === 0) {
    // 默认选择所有合集
    storySets.value.forEach(set => {
      customSetIds.value.add(set.id)
      // 如果有子合集，也选择子合集
      if (set.children) {
        set.children.forEach(child => {
          customSetIds.value.add(child.id)
        })
      }
    })
  }
}

// 获取可用的合集列表（考虑定制模式）
const getAvailableSets = computed(() => {
  if (!isCustomMode.value || customSetIds.value.size === 0) {
    return storySets.value
  }
  
  // 定制模式下，只返回用户选择的合集
  return storySets.value.filter(set => customSetIds.value.has(set.id))
})

// 切换合集选择
const toggleSetSelection = (setId) => {
  if (customSetIds.value.has(setId)) {
    customSetIds.value.delete(setId)
  } else {
    customSetIds.value.add(setId)
  }
}

// 检查合集是否被选中
const isSetSelected = (setId) => {
  return customSetIds.value.has(setId)
}

// 保存定制设置
const saveCustomSettings = () => {
  if (customSetIds.value.size === 0) {
    alert('请至少选择一个合集')
    return
  }
  
  // 保存到localStorage
  localStorage.setItem('storyCustomSetIds', JSON.stringify([...customSetIds.value]))
  isCustomMode.value = true
  showCustomizePanel.value = false

  // 检查当前选中的合集是否还在定制选择中
  const currentSetId = activeSetId.value
  const currentChildId = activeChildId.value

  // 如果当前选中的合集不在定制选择中，切换到第一个可用的合集
  if (currentSetId && !customSetIds.value.has(currentSetId)) {
    // 找到第一个可用的合集
    const firstAvailableSet = storySets.value.find(set => customSetIds.value.has(set.id))
    if (firstAvailableSet) {
      activeSetId.value = firstAvailableSet.id
      activeChildId.value = null // 重置子合集选择
    }
  }
  
  // 重新获取剧情
  currentPage.value = 1
  fetchStories()
}

</script>

<template>
  <div class="announcement">
    <Announcement 
      title="剧情百科"
      configKey="story" 
      :showTitle="true"
      :compact="true"
    />
  </div>

  <div class="story-view">
    <!--<h1 class="page-title">剧情百科</h1>-->
    
    <!-- 导航菜单 -->
    <div class="story-sets-nav">
      <div class="root-sets">
        <div 
          v-for="rootSet in getAvailableSets" 
          :key="rootSet.id" 
          class="root-set-item"
          :class="{ active: isSetActive(rootSet.id) }"
        >
          <div class="set-header" @click="toggleMenu(rootSet.id)">
            <span class="set-name-mobile">{{ getDisplayName(rootSet.id) }}</span>
            <span class="set-name-desktop">{{ getFullDisplayName(rootSet.id) }}</span>
            <span class="toggle-icon" v-if="rootSet.children && rootSet.children.length > 0">▼</span>
          </div>
          
          <!-- 下拉菜单 - 只有当用户点击展开时才显示 -->
          <div v-if="isMenuExpanded(rootSet.id) && rootSet.children && rootSet.children.length > 0" class="dropdown-menu">
            <div class="dropdown-section">
              <!-- 全部选项 -->
              <div 
                class="dropdown-item all-item"
                :class="{ active: activeChildId === null && activeSetId === rootSet.id }"
                @click.stop="selectAllInSet(rootSet.id)"
              >
                全部
              </div>
              
              <!-- 子合集列表 -->
              <div 
                v-for="childSet in rootSet.children" 
                :key="childSet.id" 
                class="dropdown-item child-item"
                :class="{ active: activeChildId === childSet.id }"
                @click.stop="selectChildSet(childSet.id)"
              >
                {{ childSet.name }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 剧情内容区域 -->
    <div class="story-content">
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>
      
      <template v-else>
        <!-- 有选中合集时显示 -->
        <template v-if="activeSetId">
          <!-- 合集说明 -->
          <div class="set-description" v-if="activeSet && (activeSet.description || activeSet.cover)">
            <div class="set-info">
              <div class="set-details">
                <p v-if="activeSet.description" class="set-desc">{{ activeSet.description }}</p>
              </div>
            </div>
          </div>
          
          <div v-if="isLoggedIn" class="set-actions">
              <button class="btn btn-add" @click="openAddStoryModal">添加剧情</button>
              <button class="btn btn-edit" @click="openEditSetModal(activeSet)">编辑</button>
              <button class="btn add-set-btn" @click="openAddSetModal">新建</button>
              <!--<button class="btn btn-delete" @click="openDeleteConfirmModal(activeSet)">删除</button>-->
          </div>
          <div class="stories-header">
            <div class="sort-area">

                <!----<button class="btn btn-mode" @click="toggleSimpleMode">
                    <i class="iconfont icon-a-jianlvemoshi-fill"></i>
                </button> -->
                <button class="btn btn-manage" @click="showCustomizePanel = !showCustomizePanel">
                    <i class="iconfont icon-shezhi"></i>
                    定制
                </button>
                <button class="btn btn-sort" @click="toggleSortDirection">
                    <i class="iconfont" :class="sortDirection === 'ASC' ? 'icon-zhengxu' : 'icon-daoxu'"></i>
                    {{ sortDirection === 'ASC' ? '正序' : '倒序' }}
                </button>
                <div class="search-area">
                  <div class="search-input-wrapper">
                    <input 
                      type="text" 
                      v-model="searchKeyword" 
                      placeholder="搜索" 
                      @keyup.enter="handleSearch"
                    />
                    <button 
                      v-if="searchKeyword" 
                      class="btn-clear-search" 
                      @click="clearSearch" 
                      title="清除搜索"
                    >
                      X
                    </button>
                  </div>
                  <button class="btn btn-search" @click="handleSearch">
                    <i class="iconfont icon-sousuo"></i>
                  </button>
                </div>
            </div>

            
          </div>

          <!-- 定制面板 -->
            <div v-if="showCustomizePanel" class="customize-panel">
              <div class="customize-header">
                <h4>选择要显示的合集</h4>
                <p class="customize-tip">勾选您想要显示的剧情合集</p>
              </div>
              
              <div class="sets-selection">
                <div 
                  v-for="set in storySets" 
                  :key="set.id" 
                  class="set-selection-item"
                  :class="{ selected: isSetSelected(set.id) }"
                  @click="toggleSetSelection(set.id)"
                >
                  <input 
                    type="checkbox" 
                    :checked="isSetSelected(set.id)"
                    @change="toggleSetSelection(set.id)"
                    class="set-checkbox"
                  />
                  <span class="set-name">{{ set.name }}</span>
                  <span v-if="set.children?.length" class="set-count">({{ set.children.length }}个子合集)</span>
                </div>
              </div>
              
              <div class="customize-actions">
                <button class="btn btn-save" @click="saveCustomSettings">
                  <i class="iconfont icon-ok"></i>
                  确定
                </button>
                <button class="btn btn-cancel" @click="showCustomizePanel = false">
                  取消
                </button>
              </div>
            </div>
          
          <!-- 剧情列表 -->
          <div v-if="stories && stories.length > 0" class="story-list">
            <div 
              v-for="story in stories" 
              :key="story.id" 
              class="story-item"
              :class="{ 'simple-mode': isSimpleMode }"
            >
              <div class="story-layout">
                <!-- 左侧内容区域 -->
                <div class="story-content-area">
                  <div class="story-header">
                    <div class="story-title">
                      <div 
                        v-html="formatStoryTitle(story.title)" 
                        @click="navigateToStoryDetail(story.id)" 
                        style="cursor:pointer"
                      ></div>
                      <i v-if="story.isRecommended" class="iconfont icon-tuijian recommended-icon"></i>
                    </div>

                    <div v-if="story.link" class="story-link">
                        <a :href="story.link" target="_blank" rel="noopener noreferrer">
                          <i class="iconfont icon-bilibili1"></i>
                        </a>
                      </div>
                    
                  </div>
                  
                  <div v-if="!isSimpleMode">
                    <div class="story-meta">
                      <span v-if="story.onlineAt" class="online-time">上线时间: {{ story.onlineAt }}</span>
                    </div>
                    
                    <div class="story-content-row">
                      <div 
                        v-if="story.content"
                        class="story-content-text"
                        @click="showCustomTooltip($event, story.content)"
                        v-html="formatStoryContent(story.content)"
                      ></div>
                      
                      
                    </div>
                  </div>
                  <div class="story-actions" v-if="isLoggedIn">
                      <button class="action-btn" @click="openCopyStoryModal(story)">
                        <i class="iconfont icon-fuzhi"></i>
                      </button>
                      <button class="action-btn" @click="openEditStoryModal(story)">
                        <i class="iconfont icon-edit"></i>
                      </button>
                      <button class="action-btn" @click="openDeleteStoryConfirmModal(story)">
                        <i class="iconfont icon-ashbin"></i>
                      </button>
                    </div>
                </div>
                
                <!-- 右侧图片区域 -->
                <div 
                  v-if="story.pictures && (!Array.isArray(story.pictures) || story.pictures.length > 0) && !isSimpleMode" 
                  class="story-image-area" 
                  @click="showImagePreview(story.pictures, story.title)"
                >
                  <img 
                    v-image="getThumbnailUrl(story.pictures, 360)"
                    :alt="story.title" 
                    class="story-thumbnail"
                  />
                </div>
              </div>
              
            </div>
            
            <!-- 分页控件 -->
            <div class="pagination" v-if="totalPages > 1">
              <button 
                class="pagination-btn" 
                :disabled="currentPage === 1"
                @click="changePage(currentPage - 1)"
              >
                上一页
              </button>
              
              <div class="pagination-info">
                <span class="cur">{{ currentPage }}</span> / {{ totalPages }} 页 <!--(共 {{ totalItems }} 条) -->
              </div>
              
              <button 
                class="pagination-btn" 
                :disabled="currentPage === totalPages"
                @click="changePage(currentPage + 1)"
              >
                下一页
              </button>
              
              <!-- 添加跳转输入框和按钮 -->
              <div class="page-jump">
                <input 
                  type="number" 
                  v-model="targetPage" 
                  min="1" 
                  :max="totalPages"
                  class="page-input"
                  placeholder="页码"
                  @keyup.enter="goToPage"
                />
                <button 
                  class="jump-btn"
                  @click="goToPage"
                >
                  跳转
                </button>
              </div>
            </div>
          </div>
          
          <div v-else class="empty-state">
            <p>当前合集暂无剧情</p>
            <div class="set-actions empty-set-actions">
              <button class="btn btn-add" @click="openAddStoryModal">添加剧情</button>
            </div>
          </div>
        </template>
        
        <!-- 未选中合集时显示 -->
        <div v-else class="welcome-message">
          <p>请选择一个合集查看剧情</p>
        </div>
      </template>
    </div>
    
    <!-- 添加合集模态框 -->
    <div v-if="showAddSetModal" class="modal-overlay">
      <div class="modal-content">
        <h3>添加剧情合集</h3>
        
        <div class="form-group">
          <label for="new-set-name">合集名称</label>
          <input 
            type="text" 
            id="new-set-name" 
            v-model="newSet.name" 
            placeholder="请输入合集名称"
          >
        </div>
        
        <div class="form-group">
          <label for="new-set-description">合集描述</label>
          <textarea 
            id="new-set-description" 
            v-model="newSet.description" 
            placeholder="请输入合集描述（可选）"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label for="new-set-cover">封面图片</label>
          <input 
            type="text" 
            id="new-set-cover" 
            v-model="newSet.cover" 
            placeholder="请输入封面图片URL（可选）"
          >
        </div>
        
        <div class="form-group">
          <label for="new-set-sort">排序</label>
          <input 
            type="number" 
            id="new-set-sort" 
            v-model="newSet.sort" 
            placeholder="请输入排序值"
          >
        </div>
        
        <div class="form-group">
          <label for="new-set-online-at">上线时间</label>
          <input 
            type="datetime-local" 
            id="new-set-online-at" 
            v-model="newSet.onlineAt" 
            placeholder="请选择上线时间（可选）"
          >
        </div>
        
        <div class="form-group">
          <label for="new-set-parent">父合集</label>
          <select id="new-set-parent" v-model="newSet.parentId">
            <option :value="0">无（根合集）</option>
            <option 
              v-for="set in storySets" 
              :key="set.id" 
              :value="set.id"
            >
              {{ set.name }}
            </option>
          </select>
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="closeAddSetModal">取消</button>
          <button class="btn btn-confirm" @click="addStorySet">确认</button>
        </div>
      </div>
    </div>
    
    <!-- 编辑合集模态框 -->
    <div v-if="showEditSetModal && editingSet" class="modal-overlay">
      <div class="modal-content">
        <h3>编辑剧情合集</h3>
        
        <div class="form-group">
          <label for="edit-set-name">合集名称</label>
          <input 
            type="text" 
            id="edit-set-name" 
            v-model="editingSet.name" 
            placeholder="请输入合集名称"
          >
        </div>
        
        <div class="form-group">
          <label for="edit-set-description">合集描述</label>
          <textarea 
            id="edit-set-description" 
            v-model="editingSet.description" 
            placeholder="请输入合集描述（可选）"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label for="edit-set-cover">封面图片</label>
          <input 
            type="text" 
            id="edit-set-cover" 
            v-model="editingSet.cover" 
            placeholder="请输入封面图片URL（可选）"
          >
        </div>
        
        <div class="form-group">
          <label for="edit-set-sort">排序</label>
          <input 
            type="number" 
            id="edit-set-sort" 
            v-model="editingSet.sort" 
            placeholder="请输入排序值"
          >
        </div>
        
        <div class="form-group">
          <label for="edit-set-online-at">上线时间</label>
          <input 
            type="datetime-local" 
            id="edit-set-online-at" 
            v-model="editingSet.onlineAt" 
            placeholder="请选择上线时间（可选）"
          >
        </div>
        
        <div class="form-group">
          <label for="edit-set-parent">父合集</label>
          <select id="edit-set-parent" v-model="editingSet.parentId">
            <option :value="0">无（根合集）</option>
            <option 
              v-for="set in storySets.filter(s => s.id !== editingSet.id)" 
              :key="set.id" 
              :value="set.id"
            >
              {{ set.name }}
            </option>
          </select>
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="closeEditSetModal">取消</button>
          <button class="btn btn-confirm" @click="updateStorySet">确认</button>
        </div>
      </div>
    </div>
    
    <!-- 删除确认模态框 -->
    <div v-if="confirmDeleteModal && setToDelete" class="modal-overlay">
      <div class="modal-content">
        <h3>确认删除</h3>
        <p>您确定要删除合集 "{{ setToDelete.name }}" 吗？此操作不可撤销。</p>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="closeDeleteConfirmModal">取消</button>
          <button class="btn btn-danger" @click="deleteStorySet">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 添加剧情模态框 -->
    <div v-if="showAddStoryModal" class="modal-overlay">
      <div class="modal-content">
        <h3>添加剧情</h3>
        
        <div class="form-group">
          <label for="add-story-title">标题</label>
          <input 
            type="text" 
            id="add-story-title" 
            v-model="newStory.title" 
            placeholder="请输入剧情标题"
          >
        </div>
        <div class="form-group">
          <div class="checkbox-item">
            <input type="checkbox" id="add-story-recommended" v-model="newStory.isRecommended">
            <label for="add-story-recommended">推荐剧情</label>
          </div>
        </div>
        
        <div class="form-group">
          <label for="add-story-content">内容</label>
          <textarea 
            id="add-story-content" 
            v-model="newStory.content" 
            placeholder="链接格式：[链接文本](https://example.com)"
            rows="5"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>图片</label>
          <div class="image-uploader">
            <input 
              type="file" 
              multiple
              accept="image/*"
              @change="handleImageUpload"
            >
            <div 
              class="preview-images"
              @dragover.prevent
              @drop.prevent="handleDrop">
              <div 
                v-for="(img, index) in newStory.pictures" 
                :key="index"
                class="preview-item"
                draggable="true"
                @dragstart="(e) => dragStart(e, index, 'new')"
                @dragover="dragOver"
                @drop="(e) => drop(e, index, 'new')"
              >
                <img v-image="getThumbnailUrl(img, 160)" class="story-thumbnail">
                <span class="remove" @click="removePicture(index)">×</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="add-story-link">外部链接</label>
          <input 
            type="text" 
            id="add-story-link" 
            v-model="newStory.link" 
            placeholder="请输入外部链接"
          >
        </div>
        
        <div class="form-group">
          <label for="add-story-online-at">上线时间</label>
          <input 
            type="datetime-local" 
            id="add-story-online-at" 
            v-model="newStory.onlineAt"
          >
        </div>
        
        <div class="form-group">
          <label>所属合集（可多选）</label>
          <div class="checkbox-group">
            <!-- 获取当前活动合集的根合集 -->
            <template v-if="getActiveRootSet()">
              <div class="checkbox-category">
                <div class="checkbox-item root-checkbox">
                  <input 
                    type="checkbox" 
                    :id="`add-set-${getActiveRootSet().id}`" 
                    :value="getActiveRootSet().id" 
                    v-model="newStory.setIds"
                  >
                  <label :for="`add-set-${getActiveRootSet().id}`" class="root-set-label">
                    {{ getActiveRootSet().name }}
                  </label>
                </div>
                
                <!-- 显示子合集（如果有） -->
                <div v-if="getActiveRootSet().children && getActiveRootSet().children.length > 0" class="child-checkboxes">
                  <div 
                    v-for="childSet in getActiveRootSet().children" 
                    :key="childSet.id" 
                    class="checkbox-item child-checkbox"
                  >
                    <input 
                      type="checkbox" 
                      :id="`add-set-${childSet.id}`" 
                      :value="childSet.id" 
                      v-model="newStory.setIds"
                    >
                    <label :for="`add-set-${childSet.id}`">{{ childSet.name }}</label>
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="no-sets-message">请先选择一个合集</p>
          </div>
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="closeAddStoryModal">取消</button>
          <button class="btn btn-confirm" @click="addStory">确认</button>
        </div>
      </div>
    </div>

    <!-- 编辑剧情模态框 -->
    <div v-if="showEditStoryModal && editingStory" class="modal-overlay">
      <div class="modal-content">
        <h3>编辑剧情</h3>
        
        <div class="form-group">
          <label for="edit-story-title">标题</label>
          <input 
            type="text" 
            id="edit-story-title" 
            v-model="editingStory.title" 
            placeholder="请输入剧情标题"
          >
        </div>
        <div class="form-group">
          <div class="checkbox-item">
            <input type="checkbox" id="edit-story-recommended" v-model="editingStory.isRecommended">
            <label for="edit-story-recommended">推荐剧情</label>
          </div>
        </div>
        
        <div class="form-group">
          <label for="edit-story-content">内容</label>
          <textarea 
            id="edit-story-content" 
            v-model="editingStory.content" 
            placeholder="链接格式：[链接文本](https://example.com)"
            rows="5"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>图片</label>
          <div class="image-uploader">
            <input 
              type="file" 
              multiple
              accept="image/*"
              @change="handleEditImageUpload"
            >
            <div 
              class="preview-images"
              @dragover.prevent
              @drop.prevent="handleEditDrop">
              <div 
                v-for="(img, index) in editingStory.pictures" 
                :key="index"
                class="preview-item"
                draggable="true"
                @dragstart="(e) => dragStart(e, index, 'edit')"
                @dragover="dragOver"
                @drop="(e) => drop(e, index, 'edit')"
              >
                <img v-image="getThumbnailUrl(img, 160)" class="story-thumbnail">
                <span class="remove" @click="removeEditPicture(index)">×</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="edit-story-link">外部链接</label>
          <input 
            type="text" 
            id="edit-story-link" 
            v-model="editingStory.link" 
            placeholder="请输入外部链接"
          >
        </div>
        
        <div class="form-group">
          <label for="edit-story-online-at">上线时间</label>
          <input 
            type="datetime-local" 
            id="edit-story-online-at" 
            v-model="editingStory.onlineAt"
          >
        </div>
        
        <div class="form-group">
          <label>所属合集（可多选）</label>
          <div class="checkbox-group">
            <!-- 获取当前活动合集的根合集 -->
            <template v-if="getActiveRootSet()">
              <div class="checkbox-category">
                <div class="checkbox-item root-checkbox">
                  <input 
                    type="checkbox" 
                    :id="`edit-set-${getActiveRootSet().id}`" 
                    :value="getActiveRootSet().id" 
                    v-model="editingStory.setIds"
                  >
                  <label :for="`edit-set-${getActiveRootSet().id}`" class="root-set-label">
                    {{ getActiveRootSet().name }}
                  </label>
                </div>
                
                <!-- 显示子合集（如果有） -->
                <div v-if="getActiveRootSet().children && getActiveRootSet().children.length > 0" class="child-checkboxes">
                  <div 
                    v-for="childSet in getActiveRootSet().children" 
                    :key="childSet.id" 
                    class="checkbox-item child-checkbox"
                  >
                    <input 
                      type="checkbox" 
                      :id="`edit-set-${childSet.id}`" 
                      :value="childSet.id" 
                      v-model="editingStory.setIds"
                    >
                    <label :for="`edit-set-${childSet.id}`">{{ childSet.name }}</label>
                  </div>
                </div>
              </div>
            </template>
            <p v-else class="no-sets-message">请先选择一个合集</p>
          </div>
        </div>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="closeEditStoryModal">取消</button>
          <button class="btn btn-confirm" @click="updateStory">确认</button>
        </div>
      </div>
    </div>

    <!-- 删除剧情确认模态框 -->
    <div v-if="confirmDeleteStoryModal" class="modal-overlay">
      <div class="modal-content">
        <h3>删除剧情</h3>
        <p>确定要删除剧情 "{{ storyToDelete?.title }}" 吗？此操作不可撤销。</p>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div class="modal-actions">
          <button class="btn btn-cancel" @click="closeDeleteStoryConfirmModal">取消</button>
          <button class="btn btn-danger" @click="deleteStory">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 使用 ImagePreview 组件 -->
    <ImagePreview
      :visible="previewVisible"
      :image-url="previewImage"
      :title="previewTitle"
      :total="previewImages.length"
      :current="currentImageIndex + 1"
      @close="closePreview"
      @prev="prevImage"
      @next="nextImage"
    />

  </div>
</template>

<style scoped>
.announcement {
  border-radius: 15px;
  padding: 0 15px 10px;
  background-color: #fff;
  box-shadow: 0 2px 2px rgba(0, 0, 0, 0.05);
}

.story-view {
  padding: 20px 0;
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.2rem;
  margin-bottom: 16px;
  color: #333;
  text-align: center;
}

/* 导航菜单样式 */
.story-sets-nav {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  position: relative;
}

.root-sets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.root-set-item {
  position: relative;
}

.set-header {
    font-size: 0.85rem;
  padding: 4px 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  transition: background-color 0.3s;
}

.set-name-mobile {
  display: block;
}

.set-name-desktop {
  display: none;
}

.set-header:hover {
  background-color: #e0e0e0;
}

.root-set-item.active .set-header {
  background-color: #4a90e2;
  color: white;
}

.toggle-icon {
  font-size: 10px;
  cursor: pointer;
  margin-left: auto;
}

/* 下拉菜单样式 */
.dropdown-menu {
    min-width: 110px;
    font-size: 0.85rem;
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 10;
  margin-top: 5px;
  border: 1px solid #eee;
  overflow: visible;
}

.dropdown-section {
  padding: 5px 0;
}

.dropdown-divider {
  height: 1px;
  background-color: #eee;
  margin: 5px 0;
}

.dropdown-item {
  padding: 6px 15px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.3s;
}

.dropdown-item:hover {
  background-color: #f5f5f5;
}

.dropdown-item.active {
  background-color: #e6f2ff;
  color: #4a90e2;
}

.root-item {
  font-weight: 500;
}

.child-item {
  padding-left: 20px;
}

.grandchild-item {
  padding-left: 35px;
  font-size: 13px;
  color: #666;
}

/* 剧情内容区域样式 */
.story-content {
  border-radius: 8px;
  min-height: 400px;
}

/* 合集说明样式 */
.set-description {
  padding: 5px 10px;
  margin-bottom: 10px;
}

.set-info {
  display: flex;
  gap: 15px;
  align-items: flex-start;
}

.set-details {
  flex: 1;
  min-width: 0;
}

.set-desc {
  font-size: 0.85rem;
  line-height: 1.5;
  color: #666;
}

.stories-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.stories-header h2 {
  margin: 0;
  color: #333;
}

.set-actions {
  display: flex;
  justify-content:flex-end;
  gap: 5px;
  margin-bottom: 5px;
}

.btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.3s;
}

.btn-edit {
  background-color: #499e8d;
  color: white;
}

.btn-delete {
  background-color: var(--color-red);
  color: white;
}

.btn-delete:hover {
  background-color: var(--color-red-hover);
}

.btn-add {
  background-color: var(--color-blue);
  color: white;
}

.btn-cancel {
  background-color: #95a5a6;
  color: white;
}

.btn-cancel:hover {
  background-color: #7f8c8d;
}

.btn-confirm {
  background-color: #499e8d;
  color: white;
}

.btn-danger {
  background-color: #e74c3c;
  color: white;
}

.btn-danger:hover {
  background-color: #c0392b;
}

.add-set-btn {
  background-color: #f59e56;
  color:#fff;
}

.empty-set-actions {
  margin-top: 20px;
  justify-content: center;
}

/* 加载状态 */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #4a90e2;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 剧情列表样式 */
.story-list {
  width: 100%;
  border-radius: 4px;
  overflow: hidden;
}

.story-item {
  border: 1px solid #eaeaea;
  background-color: white;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.story-layout {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.story-content-area {
  flex: 1;
  min-width: 0;
}

.story-content-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 5px;
}

.story-content-text {
  flex: 1;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  display: block;
}

.story-content-text * {
  display: inline;
  white-space: nowrap;
}

.story-link {
  flex-shrink: 0;
  line-height: 1;
  display: flex;
  align-items: flex-end;
}

.story-link a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #4a90e2;
  text-decoration: none;
  padding: 0;
}

.story-link .iconfont {
    font-size: 20px;
}

.story-image-area {
  width: 80px;
  max-height: 143px;
  flex-shrink: 0;
  cursor: pointer;
  overflow: hidden;
  border-radius: 4px;
  position: relative;
  align-self: stretch;
}

.story-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  transition: transform 0.3s;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
}

.story-image-area:hover .story-thumbnail {
  transform: scale(1.05);
}

/* 空状态样式 */
.empty-state, .welcome-message {
  text-align: center;
  padding: 60px 0;
  color: #999;
}

/* 修改模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: flex-start; /* 改为 flex-start */
  z-index: 1000;
  padding: 20px 0;
  /* 删除 overflow-y: auto */
  /* 移动端键盘优化 */
  height: 100vh; /* 兼容性 */
  height: 100dvh; /* 动态视口高度，支持现代浏览器 */
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  padding: 10px 25px 25px;
  width: 400px;
  max-width: 90%;
  max-height: calc(100vh - 140px); /* 调整最大高度 */
  max-height: calc(100dvh - 140px); /* 动态视口高度 */
  overflow-y: auto;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  margin-top: 10px; /* 添加固定的顶部边距 */
  /* 移动端键盘优化 */
  -webkit-overflow-scrolling: touch; /* iOS 滚动优化 */
}

.modal-content h3 {
    font-size: 1rem;
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
}

.form-group {
  margin-bottom: 10px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.form-group input, .form-group textarea, .form-group select {
  width: 100%;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.form-group textarea {
  min-height: 50px;
  resize: vertical;
}

.error-message {
  color: #d9534f;
  margin-bottom: 15px;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

/* 复选框组样式 */
.checkbox-group {
  max-height: 120px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px;
}

.checkbox-category {
  margin-bottom: 15px;
}

.checkbox-category:last-child {
  margin-bottom: 0;
}

.checkbox-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.checkbox-item label {
    margin: 0; 
    font-size: 12px;
}

.checkbox-item input[type="checkbox"] {
    width: 30px;
  margin-right: 8px;
}

.root-checkbox {
  font-weight: 500;
}

.root-set-label {
  color: #333;
}

.child-checkboxes {
  margin-left: 25px;
  margin-top: 5px;
  border-left: 1px solid #eee;
  padding-left: 10px;
}

.child-checkbox {
  margin-bottom: 5px;
}

.child-checkbox label {
  color: #555;
}

/* 日期选择器样式 */
input[type="datetime-local"] {
  width: 100%;
  padding: 5px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.no-sets-message {
  color: #999;
  text-align: center;
  padding: 10px;
}

/* 图片预览模态框样式 */
.image-preview-container {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  margin: auto;
}

.preview-image {
  max-width: 100%;
  max-height: 90vh;
  display: block;
  margin: 0 auto;
  border-radius: 4px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
}

.close-preview-btn {
  position: absolute;
  top: -20px;
  right: -20px;
  background-color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.image-uploader {
  margin-top: 10px;
}

.preview-images {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
  min-height: 80px;
  flex-wrap: wrap;
}

.preview-item {
  position: relative;
  width: 80px;
  height: 80px;
  cursor: move;/* 添加这行，表明可拖动 */
  user-select: none; /* 防止拖动时选中文本 */
}

.preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.remove {
  position: absolute;
  top: -9px;
  right: -8px;
  width: 18px;
  height: 18px;
  background: #000;
  opacity: 0.4;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.story-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.story-title {
  display: flex;
  gap: 8px;
  font-weight: 500;
  font-size: 0.9rem;
  color: #333;
  align-items: center;
}

.online-time {
    font-size: 0.8rem;
    color: #999;
}

.story-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  font-size: 16px;
  padding: 0 2px;
  transition: color 0.3s;
}

.action-btn:hover {
  color: #4a90e2;
}

.btn-mode {
  background-color: #f0f0f0;
  color: #333;
  display: flex;
  align-items: center;
  gap: 5px;
}

.btn-mode:hover {
  background-color: #e0e0e0;
}

.btn-mode .iconfont {
  font-size: 14px;
}

.story-item.simple-mode {
  padding: 8px 15px;
}

.story-item.simple-mode .story-layout {
  gap: 0;
}

/* 分页样式 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
  gap: 8px;
}

.pagination-btn, .jump-btn{
  padding: 2px 3px;
  background-color: transparent;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.3s;
  color: #9da09e;
}

.pagination-btn:hover:not(:disabled) {
  background-color: #3E3E3E;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 14px;
  color: #9da09e;
}

.pagination-info .cur {
  font-size: 16px;
  color: #5e5e5e;
}

/* 添加跳转输入框和按钮样式 */
.page-jump {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.page-input {
  width: 45px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

.jump-btn {
  margin-left: 5px;
}

.sort-area {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-sort {
  background-color: #f0f0f0;
  color: #868686;
  display: flex;
  align-items: center;
  padding: 0 6px 0 0;
}

.btn-manage {
  background-color: #eb80b4;
  color: #fff;
  padding: 3px 8px;
}
.btn-sort:hover {
  background-color: #e0e0e0;
}

.btn-sort .iconfont {
  font-size: 24px;
}

.search-area {
    margin-right: 10px;
  display: flex;
  align-items: center;
}

.search-input-wrapper {
  position: relative;
}

.search-input-wrapper input {
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 5px;
  width: 130px;
}

.btn-clear-search {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  color: #999;
}

.btn-search {
  background-color: transparent;
  border: none;
  cursor: pointer;
  padding: 0px;
  font-size: 16px;
  color: #666;
  transition: color 0.3s;
}

/* 注意：由于使用了v-html，需要使用:deep()选择器来应用样式 */
:deep(.highlight-text) {
  color: #fd964c; /* 高亮颜色，可以根据需要调整 */
  /*font-weight: bold;*/
}

/* 剧情内容中的链接样式 */
:deep(.story-link) {
  color: #499e8d;
  text-decoration: none;
  transition: color 0.3s;
}

:deep(.story-link:hover) {
  color: hsla(160, 100%, 37%, 1);
}

@media (min-width: 1024px) {
  .set-name-mobile {
    display: none;
  }
  
  .set-name-desktop {
    display: block;
  }

    .root-sets {
        gap: 8px;
    }

    .set-header {
    font-size: 0.9rem;
    padding: 5px 10px;
    gap: 8px;
    }

    .story-item {
      padding: 10px 12px;
    }

    .modal-content {
      max-height: calc(100vh - 70px);
    }
}

.custom-tooltip { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }

/* 移动端键盘弹出优化 */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 10px 0;
    align-items: flex-start;
  }
  
  .modal-content {
    width: 95%;
    max-width: 95%;
    max-height: calc(100dvh - 80px);
    margin-top: 5px;
    padding: 15px 20px 20px;
  }
  
  /* 确保模态框内容可以正常滚动 */
  .modal-content {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

.customize-panel {
  background-color: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
}

.customize-header {
  margin-bottom: 15px;
  font-size: 1.2rem;
  color: #333;
}

.customize-tip {
  font-size: 0.9rem;
  color: #666;
}

.sets-selection {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.set-selection-item {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.set-selection-item:hover {
  background-color: #f5f5f5;
}

.set-checkbox {
  margin-right: 10px;
}

.set-name {
  font-size: 0.9rem;
  color: #333;
}

.set-count {
  font-size: 0.8rem;
  color: #999;
}

.customize-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-save {
  background-color: #4a90e2;
  color: #fff;
  padding: 5px 10px;
}

.btn-cancel {
  background-color: #95a5a6;
  color: #333;
  padding: 5px 10px;
}

.btn-save:hover, .btn-cancel:hover {
  opacity: 0.9;
}
</style>
