/** 作品规格套：每套含名称、价格、材料列表 */

export function createEmptyVariant() {
  return {
    name: '',
    price: '',
    materials: [],
    picture: ''
  }
}

export function normalizeVariant(raw) {
  const materials = Array.isArray(raw?.materials) ? raw.materials : []
  return {
    name: String(raw?.name ?? '').trim(),
    price:
      raw?.price === '' || raw?.price === null || raw?.price === undefined
        ? ''
        : raw?.price,
    materials: materials
      .map((item) => {
        if (typeof item === 'number') {
          return { id: item, quantity: 1 }
        }
        if (item && item.id != null) {
          return {
            id: parseInt(item.id, 10),
            quantity: parseInt(item.quantity, 10) || 1
          }
        }
        return null
      })
      .filter(Boolean),
    picture: String(raw?.picture ?? '').trim()
  }
}

/** 从作品对象解析规格列表（兼容旧数据：仅 price + materials） */
export function parseWorkVariants(work) {
  if (!work) return [createEmptyVariant()]

  let variants = work.variants
  if (typeof variants === 'string' && variants.trim()) {
    try {
      variants = JSON.parse(variants)
    } catch {
      variants = []
    }
  }

  if (Array.isArray(variants) && variants.length) {
    return variants.map(normalizeVariant)
  }

  let legacyMaterials = work.materials || []
  if (typeof legacyMaterials === 'string') {
    try {
      legacyMaterials = JSON.parse(legacyMaterials)
    } catch {
      legacyMaterials = []
    }
  }

  return [
    normalizeVariant({
      name: '',
      price: work.price ?? '',
      materials: legacyMaterials
    })
  ]
}

export function variantLabel(variant, index) {
  const name = variant?.name?.trim()
  return name || `规格 ${index + 1}`
}

export function formatVariantPrice(price) {
  if (price === '' || price === null || price === undefined) return ''
  const num = parseFloat(price)
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

export function parseVariantPriceNumber(price) {
  if (price === '' || price === null || price === undefined) return 0
  const num = parseFloat(price)
  return Number.isNaN(num) ? 0 : num
}

/** 单作品所有规格价格之和（多规格每项均计入） */
export function sumWorkAllVariantPrices(work) {
  return parseWorkVariants(work).reduce(
    (sum, variant) => sum + parseVariantPriceNumber(variant.price),
    0
  )
}

/** 合集中所有作品、所有规格的价格总和 */
export function sumWorksCollectionPrice(works) {
  if (!Array.isArray(works)) return 0
  return works.reduce((sum, work) => sum + sumWorkAllVariantPrices(work), 0)
}

/** 根据规格关联的图片 URL 在作品 pictures 中的索引，未找到返回 -1 */
export function resolveVariantPictureIndex(pictures, pictureUrl) {
  const url = String(pictureUrl ?? '').trim()
  if (!url || !Array.isArray(pictures) || !pictures.length) return -1
  const idx = pictures.findIndex((p) => String(p ?? '').trim() === url)
  return idx
}
