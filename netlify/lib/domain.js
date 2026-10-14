import { createHmac, timingSafeEqual } from 'node:crypto';
export const consentText = 'Autorisez-vous le BCSN à prendre des images de votre équipe pendant le tournoi de Noël et à les diffuser sur ses réseaux sociaux ?';
export function validateRegistration(body, categories = []) {
  const result = {};
  for (const [key, max] of Object.entries({club:120,category:80,coach:120,email:254,phone:30,notes:1500})) {
    if (body[key] !== undefined && typeof body[key] !== 'string') throw new Error('Champ invalide.');
    result[key] = (body[key] || '').trim();
    if (result[key].length > max) throw new Error('Un champ est trop long.');
  }
  if (!result.club || !result.category || !result.coach || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Renseignez le club, la catégorie, le coach et une adresse e-mail valide.');
  if (categories.length && !categories.includes(result.category)) throw new Error('Catégorie invalide.');
  if (!['yes','no'].includes(body.imageConsent) || body.privacy !== true) throw new Error('Merci de renseigner les autorisations.');
  if (body.imageConsent === 'yes' && body.authority !== true) throw new Error('Confirmez avoir recueilli les autorisations nécessaires.');
  return {...result,email:result.email.toLowerCase(),imageConsent:body.imageConsent,authority:body.authority === true,privacy:true,consentText,consentVersion:'1'};
}
export function equal(a,b) { const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
export function signSession(secret, expires=Date.now()+8*3600000) { const value=String(expires); return value+'.'+createHmac('sha256',secret).update(value).digest('hex'); }
export function validSession(token,secret) { if (!secret || !token) return false; const [expires]=token.split('.'); return Number(expires)>Date.now() && equal(token,signSession(secret,Number(expires))); }
