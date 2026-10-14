import { EVENT_CATEGORIES } from '../../shared/event.js';
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
import { equal, signSession, validSession, validateRegistration } from '../lib/domain.js';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const categories=()=> EVENT_CATEGORIES;
const store=()=>getStore({name:process.env.CONTEXT==='production'?'christmas-registrations':`christmas-registrations-${process.env.CONTEXT||'dev'}`,consistency:'strong'});
export default async (req) => {
  const url=new URL(req.url), path=url.pathname.replace(/^.*\/(?:api)\/?/,'');
  const secret=process.env.SESSION_SECRET;
  const cookie=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('bcsn_session='))?.slice(13);
  const auth=validSession(cookie,secret);
  const secure=url.protocol==='https:'?'; Secure':'';
  const cookieHeader=value=>`bcsn_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value?28800:0}${secure}`;
  try {
    if (!['GET','HEAD'].includes(req.method)) {
      if (req.headers.get('origin')!==url.origin) return json({error:'Origine non autorisée.'},403);
      if (!(req.headers.get('content-type')||'').includes('application/json')) return json({error:'Format invalide.'},415);
      if (Number(req.headers.get('content-length')||0)>12000) return json({error:'Requête trop volumineuse.'},413);
    }
    if (path==='config' && req.method==='GET') return json({date:process.env.EVENT_DATE||'',location:process.env.EVENT_LOCATION||'',categories:categories(),contact:process.env.ORGANIZER_EMAIL||''});
    if (path==='session' && req.method==='GET') return json({authenticated:auth});
    if (path==='login' && req.method==='POST') {
      if (!secret || secret.length<32 || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length<12) return json({error:'Configurez ADMIN_PASSWORD (12 caractères minimum) et SESSION_SECRET (32 minimum) sur Netlify.'},503);
      const {password}=await req.json();
      if (typeof password!=='string' || !equal(password,process.env.ADMIN_PASSWORD)) return json({error:'Mot de passe incorrect.'},401);
      return json({ok:true},200,{'Set-Cookie':cookieHeader(signSession(secret))});
    }
    if (path==='logout' && req.method==='POST') return json({ok:true},200,{'Set-Cookie':cookieHeader('')});
    if (path==='registrations' && req.method==='POST') {
      const raw=await req.text(); if(raw.length>12000) return json({error:'Requête trop volumineuse.'},413);
      const body=JSON.parse(raw); if(body.website) return json({error:'Demande refusée.'},400);
      let data; try {data=validateRegistration(body,categories());} catch(e) {return json({error:e.message},400);}
      if(!/^[a-f0-9-]{36}$/.test(body.requestId||'')) return json({error:'Identifiant invalide.'},400);
      const db=store(),key='registration/'+body.requestId;
      const row={...data,id:body.requestId,status:'pending',createdAt:new Date().toISOString(),emailSentAt:null};
      await db.setJSON(key,row,{onlyIfNew:true});
      return json({ok:true,id:body.requestId},201);
    }
    if (!auth) return json({error:'Connectez-vous pour accéder à cet espace.'},401);
    if(path==='registrations' && req.method==='GET') {
      const db=store(),rows=[];
      for await(const page of db.list({prefix:'registration/',paginate:true})) rows.push(...await Promise.all(page.blobs.map(b=>db.get(b.key,{type:'json'}))));
      return json({rows:rows.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),mailReady:!!(process.env.RESEND_API_KEY&&process.env.MAIL_FROM)});
    }
    if(path.startsWith('registrations/') && req.method==='PATCH') {
      const id=path.split('/')[1]; if(!/^[a-f0-9-]{36}$/.test(id)) return json({error:'Identifiant invalide.'},400);
      const {status}=await req.json(); if(!['confirmed','declined','pending'].includes(status)) return json({error:'Statut invalide.'},400);
      const db=store(),key='registration/'+id,snapshot=await db.getWithMetadata(key,{type:'json'}),row=snapshot?.data; if(!row) return json({error:'Inscription introuvable.'},404);
      const changed=row.status!==status; row.status=status; row.updatedAt=new Date().toISOString(); if(changed){row.emailSentAt=null;row.notificationId=randomUUID();}
      const saved=await db.setJSON(key,row,{onlyIfMatch:snapshot.etag});
      if(!saved.modified) return json({error:'Cette inscription vient de changer. Rechargez la page avant de réessayer.'},409);
      let warning=null;
      if(status!=='pending' && !row.emailSentAt) {
        if(!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) warning='Statut enregistré. E-mail non envoyé : configurez Resend et MAIL_FROM.';
        else {
          try {
            const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`${id}-${row.notificationId||status}`},body:JSON.stringify({from:process.env.MAIL_FROM,to:[row.email],...(process.env.ORGANIZER_EMAIL?{reply_to:process.env.ORGANIZER_EMAIL}:{}),subject:`Tournoi de Noël BCSN — ${status==='confirmed'?'inscription confirmée':'votre demande d’inscription'}`,text:`Bonjour ${row.coach},\n\n${status==='confirmed'?`L’inscription de votre équipe ${row.club} (${row.category}) au tournoi de Noël est confirmée !`:`Nous sommes désolés, nous ne pouvons pas accepter la demande de votre équipe ${row.club} (${row.category}). Contactez l’organisation pour plus d’informations.`}\n\n${process.env.EVENT_DATE||''}\n${process.env.EVENT_LOCATION||''}\n\nÀ bientôt,\nÉric — Organisation BCSN`})});
            if(!response.ok) throw new Error('mail'); row.emailSentAt=new Date().toISOString(); const notified=await db.setJSON(key,row,{onlyIfMatch:saved.etag}); if(!notified.modified) return json({error:'La demande a été modifiée pendant l’envoi. Rechargez la page pour voir son état actuel.'},409);
          } catch {warning='Statut enregistré, mais l’envoi du mail a échoué. Vous pouvez réessayer depuis la fiche.';}
        }
      }
      return json({row,warning});
    }
    return json({error:'Route introuvable.'},404);
  } catch(error) { console.error('API error:',error.name); return json({error:'Le service est momentanément indisponible. Réessayez dans quelques instants.'},503); }
};
export const config={path:'/api/*',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip']}};
