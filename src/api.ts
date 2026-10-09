export type Field = { value: string | string[] | boolean | null; raw: string | null; confidence: number | null; state: string; regions: RegionRef[] }
export type RegionRef = { page: number; x: number; y: number; w: number; h: number; option?: string; detected?: string }
export type Region = RegionRef & { field: string; kind: 'text' | 'checkbox'; option?: string }
export type Document = { id: string; filename: string; status: string; created_at: string; reviewed_at: string | null; exported_at: string | null; processing_ms: number | null; pages: {index:number;width:number;height:number}[]; fields: Record<string, Field>; issues: string[]; error: string | null; correction_count: number; file_available?: boolean }
export type Workbook = { id: string; filename: string; sheet: string | null; header_row: number | null; mapping: Record<string,string>; active: number; created_at: string }
export type Sheet = { name: string; rows: number; columns: number; header_candidates: {row:number;cells:{column:number;letter:string;value:string}[]}[] }
export type Export = { id: string; workbook_id: string; created_at: string; count: number; document_ids: string[] }
export type Dashboard = { total:number;review:number;validated:number;exported:number;cancelled:number;corrected_percent:number|null;avg_processing_ms:number|null;monthly:{name:string;value:number}[];areas:{name:string;value:number}[];types:{name:string;value:number}[];cancellations:{name:string;value:number}[] }
export type Layout = {name:string;ocr_provider?:'rapidocr'|'tesseract';regions:Region[]}
export const labels: Record<string,string> = {opening_date:'Data de abertura',execution:'Execução',company_1:'Empresa 1',company_2:'Empresa 2',company_3:'Empresa 3',service_order:'Ordem de serviço',work_types:'Tipos de trabalho',area:'Área',cancelled:'PT cancelada',responsible_area:'Área responsável'}
export const statusLabels: Record<string,string> = {waiting:'Aguardando',processing:'Processando',review:'Aguardando revisão',validated:'Validado',exported:'Exportado',error:'Erro'}
const localFrontend = ['localhost','127.0.0.1'].includes(window.location.hostname)
const defaultApiOrigin = 'https://octaviorezendesilva-evonik-hacktoon.hf.space'
const apiStorageKey = 'apex-api-origin-v2'
let apiOrigin = localFrontend ? '' : localStorage.getItem(apiStorageKey) || defaultApiOrigin
let authorization = ''

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export const isLocalFrontend = () => localFrontend
export const isApiReady = () => localFrontend || Boolean(apiOrigin)
export const savedApiOrigin = () => apiOrigin || defaultApiOrigin

export function configureApi(url: string, password = '') {
  const parsed = new URL(url.trim())
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname))) {
    throw new Error('Use a URL HTTPS direta do Space, terminada em .hf.space')
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Informe somente a origem da API, por exemplo https://usuario-apex.hf.space')
  }
  apiOrigin = parsed.origin
  const credentials = new TextEncoder().encode(`apex:${password}`)
  authorization = password ? `Basic ${btoa(String.fromCharCode(...credentials))}` : ''
  localStorage.setItem(apiStorageKey, apiOrigin)
}

export function disconnectApi() { apiOrigin = ''; authorization = ''; localStorage.removeItem(apiStorageKey) }

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  if (authorization) headers.set('Authorization', authorization)
  try {
    return await fetch(`${apiOrigin}/api${path}`, {...options, headers})
  } catch {
    throw new Error('API inacessível. Confira a URL direta do Space e se ele já terminou de iniciar.')
  }
}

export async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
  const response = await request(path, options)
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('Informe a senha da API ou confira a senha digitada.', 401)
    let detail: unknown
    try { detail = (await response.json()).detail } catch { detail = response.statusText }
    throw new ApiError(typeof detail === 'string' ? detail : typeof detail === 'object' && detail && 'message' in detail ? String(detail.message) : `Falha na requisição (${response.status})`, response.status)
  }
  try {
    return await response.json() as T
  } catch {
    throw new Error('O Space respondeu, mas não retornou JSON da API. Confira a rota /api/meta.')
  }
}
export function json(method:string, body:unknown):RequestInit { return {method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} }
export async function apiBlob(path: string): Promise<Blob> {
  const response = await request(path)
  if (!response.ok) throw new ApiError(response.status === 401 ? 'Senha da API inválida.' : `Falha ao baixar arquivo (${response.status})`, response.status)
  return response.blob()
}
export async function pageImageUrl(id: string, page: number): Promise<string> {
  return URL.createObjectURL(await apiBlob(`/documents/${id}/page/${page}`))
}
export async function downloadExport(id: string) {
  const blob = await apiBlob(`/exports/${id}/download`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Apex-PDF-${id.slice(0,8)}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
export const date = (value:string|null) => value ? new Date(value).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '—'
