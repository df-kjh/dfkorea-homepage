import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadAPI } from '@/api'
import { UPLOAD_CONFIG } from '@/constants'

export type UploadFolder = 'products' | 'posts' | 'temp' | 'certificates'

/**
 * 이미지 업로드 관련 로직을 재사용 가능한 컴포저블로 제공
 */
export function useImageUpload(folder: UploadFolder = 'temp') {
  const uploading = ref(false)
  const tempImages = ref<string[]>([]) // 임시 업로드된 이미지 URL 추적

  /**
   * 파일 업로드 전 검증
   */
  const validateFile = (file: File): boolean => {
    const isImage = file.type.startsWith('image/')
    const isLt5M = file.size <= UPLOAD_CONFIG.MAX_SIZE_BYTES

    if (!isImage) {
      ElMessage.error('이미지 파일만 업로드 가능합니다!')
      return false
    }
    if (!isLt5M) {
      ElMessage.error(`이미지 크기는 ${UPLOAD_CONFIG.MAX_SIZE_MB}MB를 초과할 수 없습니다!`)
      return false
    }
    return true
  }

  /**
   * PDF 파일 검증
   */
  const validatePdfFile = (file: File): boolean => {
    const isPdf = file.type === 'application/pdf'
    const isLt10M = file.size <= 10 * 1024 * 1024 // 10MB

    if (!isPdf) {
      ElMessage.error('PDF 파일만 업로드 가능합니다!')
      return false
    }
    if (!isLt10M) {
      ElMessage.error('파일 크기는 10MB를 초과할 수 없습니다!')
      return false
    }
    return true
  }

  /**
   * 단일 이미지 업로드
   */
  const uploadSingleImage = async (file: File): Promise<string | null> => {
    if (!validateFile(file)) {
      return null
    }

    uploading.value = true
    try {
      const { data } = await uploadAPI.uploadImage(file, folder)

      // temp 폴더에 업로드된 경우 추적
      if (folder === 'temp') {
        tempImages.value.push(data.url)
      }

      return data.url
    } catch (error) {
      console.error('Failed to upload image:', error)
      ElMessage.error('이미지 업로드에 실패했습니다')
      return null
    } finally {
      uploading.value = false
    }
  }

  /**
   * PDF 파일 업로드
   */
  const uploadPdfFile = async (file: File): Promise<string | null> => {
    if (!validatePdfFile(file)) {
      return null
    }

    uploading.value = true
    try {
      const { data } = await uploadAPI.uploadFile(file, folder)

      // temp 폴더에 업로드된 경우 추적
      if (folder === 'temp') {
        tempImages.value.push(data.url)
      }

      return data.url
    } catch (error) {
      console.error('Failed to upload PDF:', error)
      ElMessage.error('PDF 업로드에 실패했습니다')
      return null
    } finally {
      uploading.value = false
    }
  }

  /**
   * 여러 이미지 업로드 (마크다운 에디터용)
   */
  const uploadMultipleImages = async (files: File[]): Promise<string[]> => {
    uploading.value = true
    try {
      const uploadPromises = files.map(async (file) => {
        const { data } = await uploadAPI.uploadImage(file, folder)

        // temp 폴더에 업로드된 경우 추적
        if (folder === 'temp') {
          tempImages.value.push(data.url)
        }

        return data.url
      })

      const urls = await Promise.all(uploadPromises)
      return urls
    } catch (error) {
      console.error('Failed to upload images:', error)
      throw error
    } finally {
      uploading.value = false
    }
  }

  /**
   * 임시 이미지 삭제 (등록 취소 시)
   */
  const clearTempImages = async () => {
    if (tempImages.value.length === 0) return

    try {
      await Promise.all(tempImages.value.map((url) => uploadAPI.deleteImage(url)))
      tempImages.value = []
      console.log('✅ Temporary images cleared')
    } catch (error) {
      console.error('Failed to clear temp images:', error)
    }
  }

  /**
   * 사용하지 않은 임시 이미지 삭제 (등록 완료 시)
   * @param usedImages 실제 사용된 이미지 URL 배열
   */
  const cleanupUnusedImages = async (usedImages: string[]) => {
    const unusedImages = tempImages.value.filter((url) => !usedImages.includes(url))

    if (unusedImages.length === 0) return

    try {
      await Promise.all(unusedImages.map((url) => uploadAPI.deleteImage(url)))
      console.log(`🗑️  Cleaned up ${unusedImages.length} unused images`)
    } catch (error) {
      console.error('Failed to cleanup unused images:', error)
    } finally {
      tempImages.value = []
    }
  }

  /**
   * 썸네일 업로드 성공 핸들러 생성
   */
  const createThumbnailSuccessHandler = (callback: (url: string) => void) => {
    return (response: { url: string }) => {
      callback(response.url)
      ElMessage.success('썸네일 이미지가 업로드되었습니다')
    }
  }

  /**
   * 썸네일 업로드 실패 핸들러
   */
  const handleThumbnailError = (error: Error) => {
    console.error('Upload error:', error)
    ElMessage.error(`이미지 업로드에 실패했습니다: ${error.message || '알 수 없는 오류'}`)
  }

  /**
   * 마크다운 에디터 이미지 업로드 핸들러 생성
   */
  const createMarkdownUploadHandler = () => {
    return async (files: File[], callback: (urls: string[]) => void) => {
      try {
        const urls = await uploadMultipleImages(files)
        callback(urls)
        ElMessage.success('이미지가 업로드되었습니다')
      } catch {
        ElMessage.error('이미지 업로드에 실패했습니다')
      }
    }
  }

  return {
    uploading,
    tempImages,
    validateFile,
    validatePdfFile,
    upload: uploadSingleImage, // ImageUploader용 alias
    uploadPdf: uploadPdfFile, // PDFUploader용
    uploadSingleImage,
    uploadPdfFile,
    uploadMultipleImages,
    clearTempImages,
    cleanupUnusedImages,
    createThumbnailSuccessHandler,
    handleThumbnailError,
    createMarkdownUploadHandler,
  }
}
