'use client'
import { useEffect, useState } from 'react'
import { Download, Share2 } from 'lucide-react'
import { Dialog } from './ui'
import type { FeedItem } from '@/lib/hub-types'
import { createStoryCard } from '@/lib/story-card'
import { message } from '@/lib/client'
export function ShareCheckIn({ item }: { item: FeedItem }) {
  const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0)
  useEffect(()=>{if(!open)return;let canceled=false;setError('');setFile(null);setNotice('');void createStoryCard(item).then(file=>{if(!canceled)setFile(file)}).catch(e=>{if(!canceled)setError(message(e))});return()=>{canceled=true}},[open,item,retry])
  useEffect(()=>{if(!file){setPreview('');return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file])
  const download=()=>{if(!file||!preview)return;const a=document.createElement('a');a.href=preview;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setNotice('Imagem salva. Abra o Instagram, crie um Story e escolha a imagem na galeria.')}
  const share=async()=>{if(!file||busy)return;if(!navigator.canShare?.({files:[file]})||!navigator.share){download();return}setBusy(true);setError('');try{await navigator.share({files:[file],title:'Meu treino no Pulso'});setNotice('Escolha o Instagram no menu do celular, quando disponível.')}catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setError('Não foi possível abrir o compartilhamento. Use Baixar imagem.')}finally{setBusy(false)}}
  return <><button className="share-checkin-button" onClick={()=>setOpen(true)}><Share2 size={17}/>Compartilhar no Instagram</button>{open&&<Dialog title="Compartilhar treino" onClose={()=>setOpen(false)}><p className="muted editor-intro">Seu treino em formato de Story, com foto, informações e a marca do Pulso. A publicação é feita por você no Instagram.</p>{preview?<img className="story-preview" src={preview} alt="Prévia do Story com os dados do treino"/>:!error&&<p role="status">Preparando sua imagem…</p>}{error&&<p className="error" role="alert">{error}</p>}{!file&&error&&<button className="button secondary" onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button>}<div className="story-actions"><button className="button primary" disabled={!file||busy} onClick={()=>void share()}><Share2 size={17}/>{busy?'Abrindo…':'Compartilhar'}</button><button className="button secondary" disabled={!file} onClick={download}><Download size={17}/>Baixar imagem</button></div>{notice&&<p role="status" className="hint">{notice}</p>}</Dialog>}</>
}
