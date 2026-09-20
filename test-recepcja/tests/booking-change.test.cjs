const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../index.html','utf8');
const start=source.indexOf('  var r21Busy='),end=source.indexOf('  function r21Error(',start);
const catalog=source.slice(source.indexOf('var OFFER_CATALOG'),source.indexOf('  var ASTERA_API_URL'));
let mode='uncertain',calls=[],serial=0,token='TEST';const pending=new Map();
const ctx=vm.createContext({console,URLSearchParams,AbortController,setTimeout,clearTimeout,
 crypto:{randomUUID:()=>String(++serial)},localStorage:{getItem:()=>token},sessionStorage:{getItem:k=>pending.get(k),setItem:(k,v)=>pending.set(k,v),removeItem:k=>pending.delete(k)},
 r2OfferVariants:s=>s.variants,r3dIsVoucher:v=>!!v.voucherNumber,R1_API:'https://example.invalid',
 fetch:async(url,options)=>{calls.push(options);if(mode==='uncertain')throw Error('NETWORK');return{json:async()=>mode==='bad'?{ok:true,booking_id:'OTHER'}:mode==='rejected'?{ok:false,error:'TERMIN_ZAJETY'}:{ok:true,booking_id:options.body.get('booking_id'),request_id:options.body.get('request_id'),operation:options.body.get('operation')}};}
});
vm.runInContext(catalog+'\n'+source.slice(start,end),ctx);
const pair=ctx.r21MatchOffer('Tajski Klasyczny (Para)',60,'SZ');assert.equal(pair.categoryId,'couples');assert.equal(pair.serviceId,'couple-classic');assert.equal(ctx.r21MatchOffer('Unknown',60,'SZ'),null);assert.equal(ctx.r21MatchOffer('Tajski Klasyczny (Para)',30,'SZ'),null);assert.equal(ctx.r21MatchOffer('Czteroręczny',60,'SZ').serviceId,'four-hands');
assert.equal(ctx.r21CanEdit({serverWritable:true,serverVersion:'version',status:'REZERWACJA',serviceId:'couple-classic'}),true);
for(const patch of [{serverWritable:false},{serverVersion:''},{status:'ODWOŁANA'},{voucherNumber:'BON'},{serviceId:''}])assert.equal(ctx.r21CanEdit({serverWritable:true,serverVersion:'version',status:'REZERWACJA',serviceId:'couple-classic',...patch}),false);
(async()=>{
 const payload={operation:'update',booking_id:'AST-SZ-TEST',expected_version:'v1',terapeuta:'Kai, Tip'};
 assert.equal((await ctx.r21SendChange(payload)).uncertain,true);const request=calls[0].body.get('request_id');
 assert.equal(calls[0].method,'POST');assert.equal(calls[0].body.get('expected_version'),'v1');assert.equal(calls[0].body.get('terapeuta'),'Kai, Tip');
 mode='bad';assert.equal((await ctx.r21SendChange(payload)).uncertain,true);assert.equal(calls[1].body.get('request_id'),request);
 mode='rejected';assert.equal((await ctx.r21SendChange(payload)).error,'TERMIN_ZAJETY');
 mode='ok';assert.equal((await ctx.r21SendChange(payload)).ok,true);assert.equal(calls[3].body.get('request_id'),request);assert.equal(pending.size,0);
 assert.equal((await ctx.r21SendChange({...payload,operation:'cancel'})).ok,true);assert.notEqual(calls[4].body.get('request_id'),request);
 token='';assert.equal((await ctx.r21SendChange(payload)).error,'BRAK_TOKENA');assert.equal(calls.length,5);
 console.log('PASS: service identity, protected read-only visits, versioned POST, uncertain retry, verified receipt, cancellation and token guard');
})().catch(e=>{console.error(e);process.exitCode=1;});
