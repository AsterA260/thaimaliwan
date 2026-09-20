// Tests of transport, uncertain results and retry identity; no external writes.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../rezerwacje/index.html','utf8');
const start=source.indexOf('function manualRequestId('),end=source.indexOf('\nlet zapisTrwa=',start);
assert.ok(start>0&&end>start);
let id=0,calls=[],mode='timeout',token='TEST',failStorage=false;
const pending=new Map();
const ctx=vm.createContext({
  S:{salon:'SZ',data:'2026-09-22',godzina:'14:00',terapeutka:'Kai, Tip',imie:'TEST REZERWACJA',tel:'',usluga:'Para',min:60,bucket:'couples'},
  crypto:{randomUUID:()=>String(++id)},sessionStorage:{getItem:k=>pending.get(k),setItem:(k,v)=>{if(failStorage)throw Error('FULL');pending.set(k,v);},removeItem:k=>pending.delete(k)},
  asteraToken:()=>token,rozbijImie:()=>({imie:'TEST',nazwisko:'REZERWACJA'}),ASTERA_MOST:'https://example.invalid',
  URLSearchParams,AbortController,setTimeout,clearTimeout,
  fetch:async(url,options)=>{calls.push({url,options});if(mode==='timeout')throw Error('NETWORK');return {json:async()=>mode==='rejected'?{ok:false,error:'TERMIN_ZAJETY'}:mode==='unconfirmed'?{ok:true}:{ok:true,booking_id:'AST-SZ-TEST',request_id:options.body.get('request_id')}};}
});
vm.runInContext(source.slice(start,end),ctx);
(async()=>{
  const first=await ctx.zapiszNaSerwer();assert.equal(first.uncertain,true);
  const request=calls[0].options.body.get('request_id');assert.ok(request);
  assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].url,'https://example.invalid');
  assert.equal(calls[0].options.body.get('terapeuta'),'Kai, Tip');assert.equal(calls[0].options.body.get('category'),'couples');
  mode='unconfirmed';assert.equal((await ctx.zapiszNaSerwer()).uncertain,true);assert.equal(calls[1].options.body.get('request_id'),request);
  mode='rejected';assert.equal((await ctx.zapiszNaSerwer()).error,'TERMIN_ZAJETY');assert.equal(pending.size,1);
  mode='success';assert.equal((await ctx.zapiszNaSerwer()).ok,true);assert.equal(calls[3].options.body.get('request_id'),request);assert.equal(pending.size,0);
  await ctx.zapiszNaSerwer();assert.notEqual(calls[4].options.body.get('request_id'),request);
  const count=calls.length;token='';assert.equal((await ctx.zapiszNaSerwer()).error,'BRAK_TOKENA');assert.equal(calls.length,count);
  token='TEST';failStorage=true;assert.equal((await ctx.zapiszNaSerwer()).ok,false);assert.equal(calls.length,count);
  console.log('PASS: POST, pair payload, uncertain retry, rejection, confirmation, new identity, missing token, storage failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
