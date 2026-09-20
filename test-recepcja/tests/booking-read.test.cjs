const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../index.html','utf8');
const a=source.indexOf('  function r1WczytajRezerwacje('),b=source.indexOf('\n  }',a)+4;
let response,fail=false,availability=0;
const ctx=vm.createContext({Date,Promise,console,encodeURIComponent,setTimeout:()=>{},
 localStorage:{getItem:()=> 'TEST'},R1_API:'https://example.invalid',R1_PROD:false,
 DATA:{ZW:{visits:[]},SZ:{visits:[{id:'old',localOnly:true,demoOnly:false}]}},
 r1Iso:(y,m,d)=>new Date(y,m,d).toISOString().slice(0,10),r1WszystkieTerapeutki:s=>s?s.split(', '):[],r1Kwota:v=>v,
 r21MatchOffer:()=>({categoryId:'couples',serviceId:'couple-classic'}),
 document:{querySelectorAll:()=>[],getElementById:()=>({})},renderAll:()=>{},toast:()=>{},r1SaveAvailability:()=>availability++,
 fetch:async()=>{if(fail)throw Error('network');return{json:async()=>response};}
});vm.runInContext(source.slice(a,b),ctx);
vm.runInContext(source.slice(source.indexOf('  function r3eCancelledVisits(){'),source.indexOf('  function r3eRenderCancelled()')),ctx);
(async()=>{
 const pair={booking_id:'AST-SZ-TEST',salon:'SZ',date:'2026-09-30',start:'14:00',end:'15:00',minutes:60,therapist:'Kai, Tip',version:'v1',editable:true,status:'REZERWACJA',booking_type:'STANDARD'};
 response={ok:true,count:1,bookings:[pair]};assert.equal(await ctx.r1WczytajRezerwacje(true),true);let rows=ctx.DATA.SZ.visits;assert.equal(rows.length,2);assert.ok(rows.every(v=>v.serverWritable&&v.serverVersion==='v1'&&v.serviceId==='couple-classic'));assert.equal(rows[0].groupId,rows[1].groupId);assert.ok(rows.every(v=>v.id!=='old'));
 response={ok:true,count:1,bookings:[{...pair,status:'ODWOŁANA',editable:false,cancelled_at:'2026-09-20T14:00:00Z'}]};assert.equal(await ctx.r1WczytajRezerwacje(true),true);assert.ok(ctx.DATA.SZ.visits.every(v=>v.status==='ODWOŁANA'&&v.cancelledAt));assert.equal(ctx.r3eCancelledVisits().length,1);assert.equal(ctx.r3eCancelledVisits()[0].visit.who,'Kai, Tip');assert.equal(ctx.DATA.SZ.visits[0].who,'Kai');
 response={ok:false,error:'UNAUTHORIZED'};assert.equal(await ctx.r1WczytajRezerwacje(true),false);assert.equal(ctx.R1_READ_INCOMPLETE,true);assert.equal(ctx.DATA.SZ.visits.length,2);
 fail=true;assert.equal(await ctx.r1WczytajRezerwacje(true),false);assert.equal(availability,2);
 console.log('PASS: pair identity, no demo/live merge, cancelled history, awaited read and fail-closed availability');
})().catch(e=>{console.error(e);process.exitCode=1;});
