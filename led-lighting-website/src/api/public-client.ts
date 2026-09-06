import axios from 'axios'
import { getApiBaseUrl } from '@/utils/api-base'
// 공개 카탈로그 조회는 관리자 자격증명 및 로그인 이동과 분리한다.
export default axios.create({ baseURL: getApiBaseUrl(), timeout: 30000 })
