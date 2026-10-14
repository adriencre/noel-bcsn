import {BlobsServer} from '@netlify/blobs/server';
import {setEnvironmentContext,getStore} from '@netlify/blobs';
import api from '../netlify/functions/api.js';
import {defaultCapacities} from '../shared/event.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
const directory=await mkdtemp(join(tmpdir(),'bcsn-capacity-'));
const server=new BlobsServer({directory,token:'test-token'});
const {port}=await server.start();
setEnvironmentContext({siteID:'test-site',token:'test-token',edgeURL:`http://127.0.0.1:${port}`,uncachedEdgeURL:`http://127.0.0.1:${port}`});
process.env.ADMIN_PASSWORD='test-password-long';process.env.SESSION_SECRET='s'.repeat(32);process.env.CONTEXT='test';delete process.env.RESEND_API_KEY;
const call=(path,method='GET',body,cookie='')=>api(new Request('https://bcsn.test/api/'+path,{method,headers:{origin:'https://bcsn.test','content-type':'application/json',cookie},...(body?{body:JSON.stringify(body)}:{})}));
try {
 const cookie=(await call('login','POST',{password:process.env.ADMIN_PASSWORD})).headers.get('set-cookie');
 const data=()=>call('registrations','GET',null,cookie).then(r=>r.json());
 assert.equal((await call('settings','PUT',{capacities:defaultCapacities()})).status,401);
 assert.equal((await data()).summary['u11-elite'].remaining,6);
 const ids=[];
 for(let i=0;i<7;i++){
  const requestId=randomUUID();ids.push(requestId);
  const input={requestId,club:'Club test '+i,category:'U11',group:'u11-elite',coach:'Coach',email:'test@example.com',imageConsent:'no',privacy:true};
  assert.equal((await call('registrations','POST',input)).status,201);
  assert.equal((await call('registrations','POST',input)).status,201);
 }
 assert.equal((await data()).rows.length,7);
 for(const id of ids.slice(0,5))assert.equal((await call('registrations/'+id,'PATCH',{status:'confirmed'},cookie)).status,200);
 const results=await Promise.all(ids.slice(5).map(id=>call('registrations/'+id,'PATCH',{status:'confirmed'},cookie)));
 assert.equal(results.filter(r=>r.status===200).length,1);
 assert.equal(results.filter(r=>r.status===409).length,1);
 let list=await data();assert.equal(list.summary['u11-elite'].confirmed,6);assert.equal(list.summary['u11-elite'].remaining,0);
 const waiting=list.rows.find(r=>r.status==='pending');
 assert.equal((await call('registrations/'+waiting.id,'PATCH',{status:'confirmed'},cookie)).status,409);
 assert.equal((await call('settings','PUT',{capacities:{...defaultCapacities(),'u11-elite':5}},cookie)).status,400);
 assert.equal((await call('registrations/'+ids[0],'PATCH',{status:'pending'},cookie)).status,200);
 assert.equal((await data()).summary['u11-elite'].remaining,1);
 assert.equal((await call('registrations/'+waiting.id,'PATCH',{status:'confirmed'},cookie)).status,200);
 assert.equal((await call('registrations/'+waiting.id,'PUT',{group:'u13-regional'},cookie)).status,400);
 assert.equal((await call('registrations/'+waiting.id,'PUT',{group:'u11-departemental'},cookie)).status,200);
 list=await data();assert.equal(list.summary['u11-elite'].remaining,1);assert.equal(list.summary['u11-departemental'].remaining,5);
 assert.equal((await call('settings','PUT',{capacities:{...defaultCapacities(),'u11-elite':8}},cookie)).status,200);
 assert.equal((await data()).settings.capacities['u11-elite'],8);
 // Existing registrations have no level: they remain visible and can be assigned.
 const legacyId=randomUUID();const db=getStore({name:'christmas-registrations-test',consistency:'strong'});
 await db.setJSON('registration/'+legacyId,{id:legacyId,category:'U13',status:'pending',createdAt:new Date().toISOString()});
 assert.equal((await call('registrations/'+legacyId,'PATCH',{status:'confirmed'},cookie)).status,400);
 assert.equal((await call('registrations/'+legacyId,'PUT',{group:'u13-regional'},cookie)).status,200);
 assert.equal((await call('registrations/'+legacyId,'PATCH',{status:'confirmed'},cookie)).status,200);
 assert.equal((await call('registrations/'+legacyId,'DELETE',null,cookie)).status,200);
 assert.equal((await call('registrations/'+legacyId,'DELETE',null,cookie)).status,404);
 assert.ok(!(await data()).rows.some(r=>r.id===legacyId));
 console.log('PASS: stockage, capacités persistantes, limite de six, validations concurrentes, libération de place, transfert de niveau et anciennes demandes, suppression.');
}finally{await server.stop();await rm(directory,{recursive:true,force:true});}
