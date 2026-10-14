import { test } from 'node:test';
import assert from 'node:assert/strict';
import {validateRegistration,signSession,validSession} from '../netlify/lib/domain.js';
const input={club:' Club test ',category:'U11',coach:'Éric Test',email:'COACH@example.com',imageConsent:'no',privacy:true};
test('normalise une inscription sans autorisation image',()=>{const row=validateRegistration(input);assert.equal(row.club,'Club test');assert.equal(row.email,'coach@example.com');assert.equal(row.imageConsent,'no');});
test('refuse les champs manquants et les emails incorrects',()=>{for(const key of ['club','coach','category','email'])assert.throws(()=>validateRegistration({...input,[key]:''}));assert.throws(()=>validateRegistration({...input,email:'test'}));});
test('exige un choix explicite et les autorisations si oui',()=>{assert.throws(()=>validateRegistration({...input,imageConsent:''}));assert.throws(()=>validateRegistration({...input,imageConsent:'yes'}));assert.equal(validateRegistration({...input,imageConsent:'yes',authority:true}).authority,true);assert.throws(()=>validateRegistration({...input,privacy:false}));});
test('vérifie catégories et longueurs côté serveur',()=>{assert.throws(()=>validateRegistration(input,['U13']));assert.throws(()=>validateRegistration({...input,notes:'a'.repeat(1501)}));assert.throws(()=>validateRegistration({...input,club:{}}));});
test('session signée valide ; expiration, falsification et mauvais secret refusés',()=>{const secret='a'.repeat(32),token=signSession(secret);assert.ok(validSession(token,secret));assert.equal(validSession(token+'x',secret),false);assert.equal(validSession(token,'b'.repeat(32)),false);assert.equal(validSession(signSession(secret,Date.now()-1),secret),false);assert.equal(validSession(undefined,secret),false);});
