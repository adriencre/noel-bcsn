import { registrations, settings, capacitySummary, validateCapacities, withAdminLock } from '../lib/tournament.js';
import { EVENT_CATEGORIES, EVENT_GROUPS } from '../../shared/event.js';
import { getStore } from '@netlify/blobs';
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
    if (path==='config' && req.method==='GET') return json({date:process.env.EVENT_DATE||'',location:process.env.EVENT_LOCATION||'',categories:categories(),groups:EVENT_GROUPS,contact:process.env.ORGANIZER_EMAIL||''});
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
      const row={...data,id:body.requestId,status:'pending',createdAt:new Date().toISOString()};
      await db.setJSON(key,row,{onlyIfNew:true});
      return json({ok:true,id:body.requestId},201);
    }
    if (!auth) return json({error:'Connectez-vous pour accéder à cet espace.'},401);
    if(path==='registrations' && req.method==='GET') {
      const db=store(),rows=await registrations(db),configuration=await settings(db);
      return json({rows,settings:configuration,summary:capacitySummary(rows,configuration.capacities)});
    }
    if(path==='settings' && req.method==='PUT') {
      const body=await req.json(),db=store();
      const result=await withAdminLock(db,async()=>{
        let capacities;try{capacities=validateCapacities(body.capacities,await registrations(db));}catch(e){return json({error:e.message},400);}
        const configuration={capacities,updatedAt:new Date().toISOString()};
        await db.setJSON('tournament/settings',configuration);
        return json({settings:configuration});
      });
      return result.busy?json({error:'Une autre modification est en cours. Réessayez dans quelques instants.'},409):result.value;
    }
    if(path.startsWith('registrations/') && req.method==='PUT') {
      const id=path.split('/')[1];if(!/^[a-f0-9-]{36}$/.test(id)) return json({error:'Identifiant invalide.'},400);
      const {group}=await req.json();
      const selected=EVENT_GROUPS.find(g=>g.id===group);
      if(!selected)return json({error:'Niveau invalide.'},400);
      const db=store(),result=await withAdminLock(db,async()=>{
        const key='registration/'+id,snapshot=await db.getWithMetadata(key,{type:'json'}),row=snapshot?.data;
        if(!row)return json({error:'Inscription introuvable.'},404);
        if(row.category!==selected.category)return json({error:'Le niveau doit correspondre à la catégorie de cette équipe.'},400);
        if(row.status==='confirmed'&&row.group!==group){
          const configuration=await settings(db),summary=capacitySummary(await registrations(db),configuration.capacities);
          if(summary[group].remaining===0)return json({error:'Ce groupe est complet. Libérez une place ou modifiez sa capacité.'},409);
        }
        row.group=group;row.updatedAt=new Date().toISOString();
        const saved=await db.setJSON(key,row,{onlyIfMatch:snapshot.etag});
        return saved.modified?json({row}):json({error:'Cette inscription a changé. Actualisez la page.'},409);
      });
      return result.busy?json({error:'Une autre modification est en cours. Réessayez.'},409):result.value;
    }
    if(path.startsWith('registrations/') && req.method==='PATCH') {
      const id=path.split('/')[1]; if(!/^[a-f0-9-]{36}$/.test(id)) return json({error:'Identifiant invalide.'},400);
      const {status}=await req.json(); if(!['confirmed','declined','pending'].includes(status)) return json({error:'Statut invalide.'},400);
      const db=store(),key='registration/'+id;
      const result=await withAdminLock(db,async()=>{
        const snapshot=await db.getWithMetadata(key,{type:'json'}),row=snapshot?.data;
        if(!row) return {error:'Inscription introuvable.',code:404};
        if(status==='confirmed' && row.status!=='confirmed') {
          const configuration=await settings(db),summary=capacitySummary(await registrations(db),configuration.capacities);
          if(!summary[row.group]) return {error:'Attribuez un niveau à cette équipe avant de la valider.',code:400};
          if(summary[row.group].remaining===0) return {error:`Le groupe de cette équipe est complet. Augmentez sa capacité ou libérez une place avant de valider.`,code:409};
        }
        row.status=status;row.updatedAt=new Date().toISOString();
        const saved=await db.setJSON(key,row,{onlyIfMatch:snapshot.etag});
        if(!saved.modified) return {error:'Cette inscription vient de changer. Actualisez avant de réessayer.',code:409};
        return {row};
      });
      if(result.busy) return json({error:'Une autre modification est en cours. Réessayez dans quelques instants.'},409);
      if(result.value.error) return json({error:result.value.error},result.value.code);
      return json({row:result.value.row});
    }
    if(path.startsWith('registrations/') && req.method==='DELETE') {
      const id=path.split('/')[1]; if(!/^[a-f0-9-]{36}$/.test(id)) return json({error:'Identifiant invalide.'},400);
      const db=store(),key='registration/'+id;
      const result=await withAdminLock(db,async()=>{
        if(!await db.get(key)) return json({error:'Inscription introuvable.'},404);
        await db.delete(key);
        return json({ok:true});
      });
      return result.busy?json({error:'Une autre modification est en cours. Réessayez.'},409):result.value;
    }
    return json({error:'Route introuvable.'},404);
  } catch(error) { console.error('API error:',error.name); return json({error:'Le service est momentanément indisponible. Réessayez dans quelques instants.'},503); }
};
export const config={path:'/api/*',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip']}};
