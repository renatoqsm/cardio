export function localDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}
export async function postJSON(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new Error(response.status === 401 ? 'Sua sessão expirou. Entre novamente.' : result?.error || 'Não foi possível salvar. Tente novamente.')
  return result
}
export async function uploadPhoto(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('A foto deve ter até 8 MB. Escolha uma imagem menor.')
  const form = new FormData(); form.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body: form, signal: AbortSignal.timeout(60000) })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.pathname) throw new Error(result?.error || 'Não foi possível enviar a foto. Tente novamente.')
  return result.pathname as string
}
export function message(error: unknown) {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'O envio demorou demais. Confira sua conexão e tente novamente.'
  if (error instanceof TypeError) return 'Não foi possível conectar. Confira sua conexão.'
  return error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.'
}
