// Offline regression: API response -> list filter -> release action. No real vouchers.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../bony/index.html'),'utf8');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Function(match[1]);
function definition(name){
  const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);
  let pos=html.indexOf('{',start),depth=1;
  for(++pos;depth;++pos){if(html[pos]==='{')++depth;if(html[pos]==='}')--depth;assert.ok(pos<html.length);}
  return html.slice(start,pos);
}
const ctx=vm.createContext({window:{__ASTERA_BONY_UI_R4__:{}},state:{salon:'ALL',status:'Ważny',query:'',otwarty:null},
  VOUCHERS:[],renderMetrics(){},renderList(){},wZakresie:()=>true,
  esc:s=>String(s||'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))});
for(const name of ['asteraVoucherStatus','asteraApplyVouchers','filtered','tag','voucherFieldHTML','voucherSourceHTML','kartaHTML'])vm.runInContext(definition(name),ctx);
let passed=0;
function check(label,fn){fn();console.log('PASS '+label);passed++;}
function voucher(status){return {n:'TEST-BON-01',salon:'ZW',status,statusRaw:status,kind:'Test usługi',minutes:60,value:168};}
for(const status of ['Wazny','Ważny','WAŻNY'])check('API '+status+' remains visible with Ważny filter and allows release',()=>{
  ctx.asteraApplyVouchers([voucher(status)]);assert.equal(ctx.filtered().length,1);
  assert.match(ctx.kartaHTML(ctx.VOUCHERS[0]),/data-release-for=/);assert.match(ctx.tag(ctx.VOUCHERS[0].status),/stat valid/);
  assert.equal(ctx.VOUCHERS[0].statusRaw,status);
});
for(const status of ['Wykorzystany','Anulowany','Wygasly','OCZEKUJĄCY','MANAGER_REVIEW','',null])check('blocked status remains blocked: '+status,()=>{
  ctx.asteraApplyVouchers([voucher(status)]);assert.equal(ctx.filtered().length,0);
  assert.doesNotMatch(ctx.kartaHTML(ctx.VOUCHERS[0]),/data-release-for=/);
});
check('normalization preserves salon and amount',()=>{
  ctx.asteraApplyVouchers([{...voucher('Wazny'),salon:'SZ',finalValue:150}]);assert.equal(ctx.VOUCHERS[0].value,150);
  ctx.state.salon='ZW';assert.equal(ctx.filtered().length,0);ctx.state.salon='SZ';assert.equal(ctx.filtered().length,1);
});
console.log(passed+' scenarios passed; inline scripts parse successfully.');

check('source identity, contacts, notes and zero survive rendering; buyer is not recipient',()=>{
  ctx.state.salon='ALL';ctx.state.query='';
  ctx.asteraApplyVouchers([{...voucher('Wazny'),buyer:'Jan Testowy',email:'test@example.invalid',customerPhone:'+48000000000',notes:'Dla obdarowanej',sheetFields:[{column:'J',label:'SUMA',value:'0'},{column:'N',label:'E-mail',value:'test@example.invalid'}]}]);
  const v=ctx.VOUCHERS[0],card=ctx.kartaHTML(v);
  assert.equal(v.client,'—');assert.equal(v.buyer,'Jan Testowy');
  for(const value of ['Jan Testowy','test@example.invalid','+48000000000','Dla obdarowanej','SUMA · J','>0</b>'])assert.ok(card.includes(value),value);
  for(const query of ['jan testowy','test@example.invalid','000000000']){ctx.state.query=query;assert.equal(ctx.filtered().length,1);}
  ctx.state.query='';
});
check('all source strings are escaped, missing contacts stay visibly missing',()=>{
  ctx.asteraApplyVouchers([{...voucher('Wazny'),buyer:'<img onerror=bad()>',notes:'<script>bad()</script>',sheetFields:[{column:'Z',label:'<svg>',value:'<iframe>'}]}]);
  const card=ctx.kartaHTML(ctx.VOUCHERS[0]);assert.doesNotMatch(card,/<img|<script|<svg|<iframe/);assert.match(card,/&lt;img/);assert.match(card,/Brak w arkuszu/);
});
