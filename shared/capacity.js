import { EVENT_GROUPS } from './event.js';
export function capacitySummary(rows, capacities) {
  return Object.fromEntries(EVENT_GROUPS.map(group=>{
    const category=group.id;
    const teams=rows.filter(r=>r.group===category);
    const confirmed=teams.filter(r=>r.status==='confirmed').length;
    const capacity=capacities[category]??null;
    return [category,{capacity,confirmed,pending:teams.filter(r=>r.status==='pending').length,remaining:capacity===null?null:Math.max(0,capacity-confirmed)}];
  }));
}
export function validateCapacities(capacities,rows) {
  const result={};
  for(const group of EVENT_GROUPS) {
    const category=group.id;
    const value=capacities?.[category];
    if(value!==null && (!Number.isInteger(value)||value<0||value>1000)) throw new Error(`Indiquez entre 0 et 1 000 places pour les ${category}, ou laissez vide.`);
    const count=rows.filter(r=>r.group===category&&r.status==='confirmed').length;
    if(value!==null&&value<count) throw new Error(`${count} équipes ${category} sont déjà acceptées. La limite ne peut pas être inférieure.`);
    result[category]=value;
  }
  return result;
}
