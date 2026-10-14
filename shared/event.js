export const EVENT_CATEGORIES = Object.freeze(['U11', 'U13']);
export const EVENT_GROUPS = Object.freeze([
  {id:'u11-elite',category:'U11',level:'Élite',capacity:6},
  {id:'u11-departemental',category:'U11',level:'Départemental',capacity:6},
  {id:'u13-regional',category:'U13',level:'Régional',capacity:6},
  {id:'u13-departemental',category:'U13',level:'Départemental',capacity:6},
]);
export const groupLabel = id => { const group=EVENT_GROUPS.find(g=>g.id===id);return group?`${group.category} · ${group.level}`:'Niveau à attribuer'; };
export const defaultCapacities = () => Object.fromEntries(EVENT_GROUPS.map(g=>[g.id,g.capacity]));
