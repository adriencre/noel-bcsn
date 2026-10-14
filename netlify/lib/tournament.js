import { defaultCapacities } from '../../shared/event.js';
import { randomUUID } from 'node:crypto';
export { capacitySummary, validateCapacities } from '../../shared/capacity.js';
export async function registrations(db) {
  const rows=[];
  for await (const page of db.list({prefix:'registration/',paginate:true})) {
    rows.push(...await Promise.all(page.blobs.map(b=>db.get(b.key,{type:'json'}))));
  }
  return rows.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function settings(db) {
  return (await db.get('tournament/settings',{type:'json'})) || {capacities:defaultCapacities()};
}
// Serialize admin decisions across function instances to avoid accepting the last place twice.
async function withDistributedAdminLock(db,action) {
  const key='tournament/admin-lock';
  const current=await db.getWithMetadata(key,{type:'json'});
  if(current?.data.expires>Date.now()) return {busy:true};
  const lock=await db.setJSON(key,{owner:randomUUID(),expires:Date.now()+120000},current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
  if(!lock.modified) return {busy:true};
  try {return {value:await action()};}
  finally {await db.setJSON(key,{expires:0},{onlyIfMatch:lock.etag});}
}

let localAdminBusy=false;
export async function withAdminLock(db,action) {
  if(localAdminBusy)return {busy:true};
  localAdminBusy=true;
  try{return await withDistributedAdminLock(db,action);}
  finally{localAdminBusy=false;}
}
