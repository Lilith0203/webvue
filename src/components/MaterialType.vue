<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from '../api'
import { confirm } from '../utils/confirm'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const canEdit = computed(() => authStore.isAuthenticated)

const typeTree = ref([])
const loading = ref(false)
const error = ref(null)
const expandedTypes = ref(new Set())

// 编辑状态
const editingType = ref(null)
const editForm = ref({ 
    id: null,
    typeName: '' 
})

// 新增状态
const isAddingType = ref(false)
const newTypeForm = ref({
  typeName: '',
  parentId: null
})

// 获取类型树
const fetchTypeTree = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await axios.get('/getMaterialType')
    typeTree.value = response.data.typetree
  } catch (err) {
    // 未登录（401）时：按空树处理，不显示报错
    if (err?.response?.status === 401) {
      typeTree.value = []
      error.value = null
    } else {
      error.value = "获取类型数据失败：" + err.message
      console.error('Fetch error:', err)
    }
  } finally {
    loading.value = false
  }
}

// 切换展开状态
const toggleExpand = (typeId) => {
  if (expandedTypes.value.has(typeId)) {
    expandedTypes.value.delete(typeId)
  } else {
    expandedTypes.value.add(typeId)
  }
}

// 开始编辑
const startEdit = (type) => {
  editingType.value = type.id
  editForm.value = { 
    id: type.id,
    typeName: type.typeName 
  }
}

// 保存编辑
const saveEdit = async () => {
  if (!canEdit.value) return
  try {
    await axios.post(`/updateMaterialType`, editForm.value)
    await fetchTypeTree() // 重新加载数据
    editingType.value = null
  } catch (err) {
    error.value = "保存失败：" + err.message
  }
}

// 取消编辑
const cancelEdit = () => {
  editingType.value = null
  editForm.value = { 
    id: null,
    typeName: '' 
  }
}

// 删除类型
const deleteType = async (typeId) => {
  if (!canEdit.value) return
  let materialCount = 0
  try {
    const res = await axios.get('/material/countByType', { params: { type: typeId } })
    materialCount = typeof res.data?.count === 'number' ? res.data.count : 0
  } catch (err) {
    if (err?.response?.status === 401) return
    error.value = '检查材料数量失败：' + (err?.message || '')
    return
  }
  const msg =
    materialCount > 0
      ? `该类型下仍有 ${materialCount} 条材料；删除类型不会删除这些材料，但可能影响分类展示。确定删除该类型吗？`
      : '确定要删除此类型吗？'
  if (!await confirm(msg)) {
    return
  }

  try {
    await axios.post(`/deleteMaterialType`, { id: typeId })
    await fetchTypeTree() // 重新加载数据
  } catch (err) {
    error.value = "删除失败：" + err.message
  }
}

// 添加新类型
const addType = async () => {
  if (!canEdit.value) return
  try {
    await axios.post('/addMaterialType', newTypeForm.value)
    await fetchTypeTree() // 重新加载数据
    isAddingType.value = false
    newTypeForm.value = { typeName: '', parentId: null }
  } catch (err) {
    error.value = "添加失败：" + err.message
  }
}

// 返回材料页
const goBackToMaterials = () => {
  router.push('/material')
}

onMounted(() => {
  // 未登录：不请求数据，直接显示空树
  if (canEdit.value) {
    fetchTypeTree()
  } else {
    typeTree.value = []
    error.value = null
  }
})

// 登录状态变化时自动刷新/清空（未登录不请求）
watch(
  () => authStore.isAuthenticated,
  (loggedIn) => {
    if (loggedIn) {
      fetchTypeTree()
    } else {
      typeTree.value = []
      error.value = null
    }
  }
)
</script>

<template>
  <div class="type-manager">
    <!-- 返回按钮 -->
    <div class="header-actions">
      <button class="back-button" @click="goBackToMaterials">
        ← 返回材料页
      </button>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="error" class="error">{{ error }}</div>
    
    <!-- 加载提示 -->
    <div v-if="loading" class="loading">加载中...</div>
    
    <!-- 添加新类型按钮 -->
    <button v-if="canEdit" class="add-button" @click="isAddingType = true">
      添加新类型
    </button>
    
    <!-- 新增类型表单 -->
    <div v-if="canEdit && isAddingType" class="add-form">
      <input 
        v-model="newTypeForm.typeName"
        placeholder="输入类型名称">
      <select v-model="newTypeForm.parentId">
        <option :value="null">一级类型</option>
        <option 
          v-for="type in typeTree" 
          :key="type.id"
          :value="type.id">
          {{ type.typeName }}
        </option>
      </select>
      <button @click="addType"><i class="iconfont icon-ok"></i></button>
      <button @click="isAddingType = false"><i class="iconfont icon-cancel-test"></i></button>
    </div>
    
    <!-- 类型树 -->
    <div class="type-tree">
      <template v-for="type in typeTree" :key="type.id">
        <div class="type-item">
          <!-- 展开/收起箭头 -->
          <span 
            v-if="type.children?.length"
            class="expand-arrow"
            @click="toggleExpand(type.id)">
            {{ expandedTypes.has(type.id) ? '▼' : '▶' }}
          </span>
          <span v-else class="expand-placeholder"></span>
          
          <!-- 类型名称/编辑框 -->
          <template v-if="editingType === type.id">
            <input 
              v-model="editForm.typeName"
              @keyup.enter="saveEdit"
              @keyup.esc="cancelEdit">
            <button @click="saveEdit"><i class="iconfont icon-ok"></i></button>
            <button @click="cancelEdit"><i class="iconfont icon-cancel-test"></i></button>
          </template>
          <template v-else>
            <span class="type-name">{{ type.typeName }}</span>
            <div v-if="canEdit" class="actions">
              <button @click="startEdit(type)"><i class="iconfont icon-edit"></i></button>
              <button @click="deleteType(type.id)"><i class="iconfont icon-ashbin"></i></button>
            </div>
          </template>
        </div>
        
        <!-- 子类型 -->
        <div 
          v-if="type.children?.length && expandedTypes.has(type.id)"
          class="children"
          :style="{ paddingLeft: '20px' }">
          <div 
            v-for="child in type.children"
            :key="child.id"
            class="type-item">
            <template v-if="editingType === child.id">
              <input 
                v-model="editForm.typeName"
                @keyup.enter="saveEdit"
                @keyup.esc="cancelEdit">
              <button @click="saveEdit"><i class="iconfont icon-ok"></i></button>
              <button @click="cancelEdit"><i class="iconfont icon-cancel-test"></i></button>
            </template>
            <template v-else>
              <span class="type-name">{{ child.typeName }}</span>
              <div v-if="canEdit" class="actions">
                <button @click="startEdit(child)"><i class="iconfont icon-edit"></i></button>
                <button @click="deleteType(child.id)"><i class="iconfont icon-ashbin"></i></button>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.type-manager {
  padding: 10px 10px;
  max-width: 800px;
  margin: 0 auto;
  font-size: 0.85rem;
}

.header-actions {
  margin-bottom: 15px;
}

.back-button {
  background-color: transparent;
  color: #606266;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.add-button {
  margin: 10px 0;
  padding: 4px 10px;
  background-color: var(--color-blue);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-form {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.add-form button {
  padding: 0;
  background-color: transparent;
  border: none;
  cursor: pointer;
}

.add-form i {
  font-size: 1.1rem;
}

.add-form input, .add-form select {
  max-width: 100px;
  font-size: 0.85rem;
}

.type-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
  gap: 8px;
}

.children .type-item {
  padding-left: 30px;
}

.expand-arrow {
  cursor: pointer;
  user-select: none;
  width: 20px;
  color: #666;
}

.expand-placeholder {
  width: 20px;
}

.type-name {
  flex: 1;
}

.actions {
  display: flex;
  gap: 8px;
}

.type-item button {
  background-color: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.type-item button i{
  font-size: 1.1rem;
}

.actions button:hover {
  background-color: #ecf5ff;
}

.error {
  color: #f56c6c;
  margin-bottom: 15px;
}

.loading {
  color: #909399;
  margin-bottom: 15px;
}

input {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

select {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}

@media (min-width: 1024px) {
  .type-manager {
    margin: 100px auto 120px;
  }
}
</style>