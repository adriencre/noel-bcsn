export const EVENT_CATEGORIES = Object.freeze(['U11', 'U13']);
export const EVENT_GROUPS = Object.freeze([
  {id:'u11-elite',category:'U11',level:'Élite',capacity:6},
  {id:'u11-departemental',category:'U11',level:'Départemental',capacity:6},
  {id:'u13-regional',category:'U13',level:'Régional',capacity:6},
  {id:'u13-departemental',category:'U13',level:'Départemental',capacity:6},
]);
export const groupLabel = id => { const group=EVENT_GROUPS.find(g=>g.id===id);return group?`${group.category} · ${group.level}`:'Niveau à attribuer'; };
export const defaultCapacities = () => Object.fromEntries(EVENT_GROUPS.map(g=>[g.id,g.capacity]));
export const HELLOASSO_URL='https://www.helloasso.com/associations/basket-club-saint-nicolas/evenements/bc-saint-nicolas-tournoi-noel-2026';
export const confirmationMail=(row,date='',location='')=>({subject:'Tournoi de Noël BCSN — inscription confirmée',text:`Bonjour ${row.coach},\n\nL’inscription de votre équipe ${row.club} (${groupLabel(row.group)}) au tournoi de Noël est confirmée !\n\nPour participer, merci de régler les droits d’inscription sur HelloAsso :\n${HELLOASSO_URL}\nIls comprennent le repas (pâtes bolo ou autre accompagnement) pour 10 joueurs + le coach.\n\n${date}\n${location}\n\nÀ bientôt,\nÉric — Organisation BCSN`});
