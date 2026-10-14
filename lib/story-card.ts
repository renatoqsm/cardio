import type { FeedItem } from './hub-types'
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = []
  for (const paragraph of text.replace(/\s+/g,' ').trim().split(/\r?\n/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && ctx.measureText(`${line} ${word}`).width > width) { result.push(line); line = '' }
      if (ctx.measureText(word).width > width) {
        for (const char of word) { if (ctx.measureText(line + char).width > width) { result.push(line); line = '' }; line += char }
      } else line += `${line ? ' ' : ''}${word}`
    }
    result.push(line)
  }
  return result
}
async function loadImage(path: string) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('Não foi possível carregar a foto do treino. Tente novamente.')
  const url = URL.createObjectURL(await response.blob())
  try { const image = new Image(); image.src = url; await image.decode(); return image } finally { URL.revokeObjectURL(url) }
}
export async function createStoryCard(item: FeedItem) {
  if (!item.proofPathname.startsWith('/api/proofs/')) throw new Error('Foto do treino inválida.')
  const [photo, logo] = await Promise.all([loadImage(item.proofPathname), loadImage('/icons/pulso-192.png')])
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Seu navegador não conseguiu preparar a imagem.')
  ctx.fillStyle = '#0b1410'; ctx.fillRect(0, 0, 1080, 1920)
  ctx.drawImage(logo, 64, 64, 88, 88); ctx.fillStyle = '#f3f6ee'; ctx.font = 'bold 72px system-ui'; ctx.fillText('pulso.', 174, 136)
  ctx.font = 'bold 25px system-ui'; ctx.fillStyle = '#c7ff47'; ctx.fillText(item.modality === 'strength' ? 'CHECK-IN DE MUSCULAÇÃO' : 'CARDIO REGISTRADO', 64, 208)
  ctx.font = 'bold 36px system-ui'; ctx.fillStyle = '#f3f6ee'; const nameLines = lines(ctx, item.name, 950); nameLines.forEach((line,i) => ctx.fillText(line,64,258+i*44))
  const dateY = 306 + (nameLines.length - 1) * 44
  ctx.font = '26px system-ui'; ctx.fillStyle = '#a7b8a9'; const date = new Date(`${item.recordDate}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); ctx.fillText(date,64,dateY)
  let font = 30, description: string[] = []
  while (font >= 14) { ctx.font = `${font}px system-ui`; description = item.description ? lines(ctx,item.description,940) : []; if (description.length * (font + 9) <= 520 || font === 14) break; font-- }
  const photoY = dateY + 34, photoHeight = Math.min(1000, 1690 - photoY - 220 - description.length * (font+9))
  ctx.save(); ctx.beginPath(); ctx.roundRect(64,photoY,952,photoHeight,32); ctx.clip()
  const scale = Math.max(952/photo.width,photoHeight/photo.height), width = photo.width*scale,height=photo.height*scale
  ctx.drawImage(photo,64+(952-width)/2,photoY+(photoHeight-height)/2,width,height); ctx.restore()
  let y = photoY + photoHeight + 54
  ctx.fillStyle = '#c7ff47'; ctx.font = 'bold 30px system-ui'; ctx.fillText(item.activityType || (item.modality === 'strength' ? 'Musculação' : 'Cardio'),64,y,952); y += 66
  const number = (n: number) => n.toLocaleString('pt-BR',{maximumFractionDigits:2})
  if(item.modality==='strength') {ctx.fillStyle='#f3f6ee';ctx.font='bold 58px system-ui';ctx.fillText('+1 check-in',64,y)}
  else {
    const metrics = [['DISTÂNCIA',`${number(Number(item.kilometers))} km`],['TEMPO',`${item.minutes} min`],...(item.pace ? [['PACE',`${Math.floor(Math.round(Number(item.pace)*60)/60)}:${String(Math.round(Number(item.pace)*60)%60).padStart(2,'0')} /km`]] : [])]
    metrics.forEach(([label,value],i)=>{const x=64+i*320;ctx.fillStyle='#a7b8a9';ctx.font='22px system-ui';ctx.fillText(label,x,y-24);ctx.fillStyle='#f3f6ee';ctx.font='bold 45px system-ui';ctx.fillText(value,x,y+30,300)})
  }
  y += 88; ctx.font = `${font}px system-ui`; ctx.fillStyle = '#d3dfd3'; description.forEach((line,i)=>ctx.fillText(line,64,y+i*(font+9)))
  ctx.fillStyle='#c7ff47';ctx.font='bold 25px system-ui';ctx.fillText('SEU RITMO. SUA TURMA.',64,1824);ctx.fillStyle='#a7b8a9';ctx.font='22px system-ui';ctx.fillText(window.location.host,64,1868,940)
  const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível gerar a imagem.')),'image/png'))
  return new File([blob],`pulso-${item.modality}-${item.recordDate}.png`,{type:'image/png'})
}
