import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capacitySummary,validateCapacities} from '../shared/capacity.js';
import {defaultCapacities} from '../shared/event.js';
test('24 places, réparties en quatre groupes de six',()=>{
 const capacities=defaultCapacities();assert.equal(Object.values(capacities).reduce((a,b)=>a+b,0),24);
 for(const item of Object.values(capacitySummary([],capacities)))assert.equal(item.remaining,6);
});
test('seules les équipes acceptées prennent une place dans leur niveau',()=>{
 const rows=[{group:'u11-elite',status:'confirmed'},{group:'u11-elite',status:'pending'},{group:'u11-elite',status:'declined'},{category:'U11',status:'confirmed'}];
 const summary=capacitySummary(rows,defaultCapacities());assert.equal(summary['u11-elite'].remaining,5);assert.equal(summary['u11-elite'].pending,1);assert.equal(summary['u11-departemental'].remaining,6);
 rows[0].status='pending';assert.equal(capacitySummary(rows,defaultCapacities())['u11-elite'].remaining,6);
});
test('capacité complète, capacité fermée et limites invalides',()=>{
 const rows=Array.from({length:6},()=>({group:'u13-regional',status:'confirmed'}));
 assert.equal(capacitySummary(rows,defaultCapacities())['u13-regional'].remaining,0);
 assert.throws(()=>validateCapacities({...defaultCapacities(),'u13-regional':5},rows));
 for(const value of [-1,2.5,'6',undefined,1001])assert.throws(()=>validateCapacities({...defaultCapacities(),'u11-elite':value},[]));
 assert.equal(validateCapacities({...defaultCapacities(),'u11-elite':0},[])['u11-elite'],0);
});
