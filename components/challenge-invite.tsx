'use client'
import { useState } from 'react'
import { Share2,Copy } from 'lucide-react'
import { Dialog } from './ui'
export function ChallengeInvite({code,name}:{code:string;name:string}){
 const [open,setOpen]=useState(false),[notice,setNotice]=useState('')
 const url=()=>{const link=new URL('/',window.location.origin);link.searchParams.set('join',code);return link.toString()}
 const share=async()=>{try{if(navigator.share)await navigator.share({title:`Entre em ${name} no Pulso`,text:`Vamos treinar juntos em ${name}!`,url:url()});else{await navigator.clipboard.writeText(url());setNotice('Link copiado. Envie para sua turma.')}}catch(e){if((e as Error).name!=='AbortError')setNotice('Use o link abaixo para compartilhar.')}}
 return <><button className="button secondary compact" onClick={()=>{setNotice('');setOpen(true)}}><Share2 size={16}/>Convidar</button>{open&&<Dialog title="Convide sua turma" onClose={()=>setOpen(false)}><p className="editor-intro">Envie o link por WhatsApp ou pelo aplicativo que preferir. Quem abrir poderá entrar após acessar a própria conta.</p><input className="invite-link-input" aria-label="Link do convite" value={url()} readOnly onFocus={e=>e.target.select()}/><div className="story-actions"><button className="button primary" onClick={()=>void share()}><Share2 size={17}/>Compartilhar convite</button><button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(url());setNotice('Link copiado.')}catch{setNotice('Selecione e copie o link acima.')}}}><Copy size={17}/>Copiar link</button></div><p className="hint">Chave alternativa: {code}</p>{notice&&<p role="status" className="notice">{notice}</p>}</Dialog>}</>
}
