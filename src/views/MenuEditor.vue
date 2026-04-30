<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../api'
import { useAuthStore } from '../stores/auth'
import { message } from '../utils/message'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAuthenticated && authStore.user?.role === 'admin')
const isEdit = computed(() => !!route.params.id)

const loading = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)

const form = ref({
  name: '',
  staple: '',
  ingredients: '',
  steps: '',
  pictures: []
})

const fetchMenu = async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const res = await axios.get(`/menus/${route.params.id}`)
    if (!res.data?.success) throw new Error(res.data?.message || '加载失败')
    const m = res.data.data
    form.value = {
      name: m.name || '',
      staple: m.staple || '',
      ingredients: m.ingredients || '',
      steps: m.steps || '',
      pictures: Array.isArray(m.pictures) ? m.pictures : []
    }
  } catch (e) {
    message.alert(e?.response?.data?.message || e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const uploadImage = async (file) => {
  if (!file || !file.type?.startsWith('image/')) {
    message.alert('请选择图片文件')
    return
  }
  uploading.value = true
  uploadProgress.value = 0
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'menu')
    const res = await axios.post('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (!evt.total) return
        uploadProgress.value = Math.round((evt.loaded * 100) / evt.total)
      }
    })
    const url = res.data?.url
    if (url) form.value.pictures.push(url)
  } catch (e) {
    message.alert('上传失败')
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

const onPickPictures = (e) => {
  const files = Array.from(e.target.files || [])
  files.forEach(uploadImage)
  e.target.value = ''
}

const removePic = (idx) => {
  form.value.pictures.splice(idx, 1)
}

const save = async () => {
  if (!isAdmin.value) return
  const name = (form.value.name || '').trim()
  if (!name) {
    message.alert('请输入菜名')
    return
  }
  loading.value = true
  try {
    if (isEdit.value) {
      const res = await axios.put(`/menus/${route.params.id}`, form.value)
      if (!res.data?.success) throw new Error(res.data?.message || '保存失败')
      router.push(`/menu/${route.params.id}`)
    } else {
      const res = await axios.post('/menus', form.value)
      if (!res.data?.success) throw new Error(res.data?.message || '保存失败')
      const id = res.data?.data?.id
      router.push(id ? `/menu/${id}` : '/kitchen')
    }
  } catch (e) {
    message.alert(e?.response?.data?.message || e?.message || '保存失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!isAdmin.value) {
    message.alert('无权限：仅管理员可编辑菜单')
    router.push('/kitchen')
    return
  }
  fetchMenu()
})
</script>

<template>
  <main>
    <div class="content-wrapper">
      <div class="head">
        <h2 class="title">{{ isEdit ? '编辑菜单' : '新建菜单' }}</h2>
      </div>

      <div class="form">
        <div class="row">
          <label>菜名</label>
          <input v-model="form.name" type="text" placeholder="例如：番茄鸡蛋面" />
        </div>
        <div class="row">
          <label>主食</label>
          <input v-model="form.staple" type="text" placeholder="例如：面 / 米饭 / 土豆" />
        </div>
        <div class="row">
          <label>配料</label>
          <textarea v-model="form.ingredients" rows="5" placeholder="按行写更清晰"></textarea>
        </div>
        <div class="row">
          <label>步骤</label>
          <textarea v-model="form.steps" rows="10" placeholder="按行写步骤 1/2/3..."></textarea>
        </div>

        <div class="row">
          <label>图片（多图）</label>
          <input class="file-upload" type="file" accept="image/*" multiple @change="onPickPictures" />
          <div v-if="uploading" class="progress">上传中：{{ uploadProgress }}%</div>
          <div v-if="form.pictures.length" class="pics">
            <div v-for="(u, idx) in form.pictures" :key="u + idx" class="pic-item">
              <img :src="u" class="pic" />
              <button type="button" class="rm" @click="removePic(idx)">×</button>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn primary" :disabled="loading || uploading" @click="save">{{ loading ? '保存中...' : '保存' }}</button>
          <button class="btn" :disabled="loading || uploading" @click="router.back()">取消</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.content-wrapper { max-width: 900px; margin: 20px auto; }
.title { font-size: 1.1rem; margin: 0 0 12px; }
.form { border:1px dashed #e6e6e6; border-radius: 8px; padding: 14px; background:#fff; }
.row { display:flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
label { color:#666; font-size: 0.9rem; }
input, textarea { 
  border:1px solid #ddd; 
  border-radius: 6px; 
  padding: 8px 10px; 
  font-size: 0.9rem; 
}

.file-upload {
  font-size: 0.8rem;
}
.actions { display:flex; gap: 10px; }
.btn { 
  border:1px solid #ddd; 
  border-radius: 4px; 
  padding: 3px 10px; 
  background:#fff; 
  cursor:pointer; 
}
.btn.primary { background: var(--color-blue); color:#fff; border-color: transparent; }
.progress { color:#666; font-size: 12px; margin-top: 6px; }
.pics { display:grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 8px; }
.pic-item { position: relative; }
.pic { width:100%; height:120px; object-fit: cover; border-radius: 8px; border:1px solid #eee; }
.rm { position:absolute; top:6px; right:6px; width:22px; height:22px; border:none; border-radius: 11px; background: rgba(0,0,0,0.55); color:#fff; cursor:pointer; }
</style>

