// node test-recepcja/tests/rezerwacje.test.cjs
// Pure logic tests. No browser, network, production data or credentials.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const main = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const manual = fs.readFileSync(path.join(__dirname, '../rezerwacje/index.html'), 'utf8');
for (const source of [main, manual]) {
  for (const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Function(match[1]);
}
function definition(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  let pos = source.indexOf('{', start), depth = 1;
  // These selected pure functions have balanced braces in literals too.
  for (++pos; depth; ++pos) {
    if (source[pos] === '{') ++depth;
    if (source[pos] === '}') --depth;
    assert.ok(pos < source.length, name + ' closing brace');
  }
  return source.slice(start, pos);
}
const storage = new Map();
const ctx = vm.createContext({
  S: { salon:'SZ',data:'2026-09-20',min:60,bucket:'single',usluga:'Masaż',terapeutka:'Kai' },
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  Date,Map,Set,console,token:'',asteraToken:()=>ctx.token,
  R1_PROD:false,R1_LOCAL_DIRTY:false,R1_READ_INCOMPLETE:false,R1_READ_AT:Date.now(),R1_READ_FROM:'2026-09-01',R1_READ_TO:'2026-10-01',toast:()=>{},
  DATA:{SZ:{team:[['Kai','',true],['Tip','',true]],visits:[]},ZW:{team:[],visits:[]}},
  min:t=>Number(t.split(':')[0])*60+Number(t.split(':')[1]),
  r3cTime:n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')
});
for (const name of ['dwieTerapeutki','godzinaMiesciUsluge','odczytGrafiku','konfliktWGrafiku','lokalnyKonflikt']) vm.runInContext(definition(manual,name),ctx);
for (const name of ['r3cValidateMove','r1SaveLocalState','r1BookingGroup','r1MarkLocalChange','r1SaveAvailability']) vm.runInContext(definition(main,name),ctx);
let passed=0;
function check(label, run){run();++passed;console.log('PASS '+label);}
function snapshot(extra={}){
  storage.set('astera.dostepnosc',JSON.stringify({source:'demo',readAt:Date.now(),from:'2026-09-01',to:'2026-10-01',salons:{SZ:{team:[['Kai','',true],['Tip','',true]],visits:[{id:'busy',date:'2026-09-20',t:'15:00',end:'16:00',who:'Kai',status:'REZERWACJA'}]}},...extra}));
}
snapshot();
check('full service fits closing time',()=>{ctx.S.min=90;assert.equal(ctx.godzinaMiesciUsluge('21:30'),true);assert.equal(ctx.godzinaMiesciUsluge('22:00'),false);ctx.S.min=60;});
check('invalid minutes and before opening rejected',()=>{assert.equal(ctx.godzinaMiesciUsluge('12:90'),false);assert.equal(ctx.godzinaMiesciUsluge('11:30'),false);});
check('busy start rejected',()=>assert.equal(ctx.lokalnyKonflikt('15:00','Kai'),true));
check('overlap from preceding slot rejected',()=>assert.equal(ctx.lokalnyKonflikt('14:30','Kai'),true));
check('touching interval boundaries allowed',()=>{assert.equal(ctx.lokalnyKonflikt('14:00','Kai'),false);assert.equal(ctx.lokalnyKonflikt('16:00','Kai'),false);});
check('other therapist remains free',()=>assert.equal(ctx.lokalnyKonflikt('15:00','Tip'),false));
check('other day does not cause false collision',()=>{ctx.S.data='2026-09-21';assert.equal(ctx.lokalnyKonflikt('15:00','Kai'),false);ctx.S.data='2026-09-20';});
check('pair requires two distinct people',()=>{ctx.S.bucket='couples';assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);assert.equal(ctx.lokalnyKonflikt('12:00','Kai, Kai'),true);assert.equal(ctx.lokalnyKonflikt('12:00','Kai, Tip'),false);});
check('pair checks the second person too',()=>assert.equal(ctx.lokalnyKonflikt('15:00','Tip, Kai'),true));
check('four hands also requires two',()=>{ctx.S.bucket='single';ctx.S.usluga='Masaż czteroręczny';assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);assert.equal(ctx.lokalnyKonflikt('12:00','Kai, Tip'),false);ctx.S.usluga='Masaż';});
check('cancelled local override releases snapshot interval',()=>{storage.set('astera.makietaRezerwacje',JSON.stringify([{id:'busy',salon:'SZ',date:'2026-09-20',t:'15:00',end:'16:00',who:'Kai',status:'ODWOŁANA'}]));assert.equal(ctx.lokalnyKonflikt('15:00','Kai'),false);storage.delete('astera.makietaRezerwacje');});
check('new local booking blocks same interval',()=>{storage.set('astera.makietaRezerwacje',JSON.stringify([{id:'new',salon:'SZ',date:'2026-09-20',t:'12:00',end:'13:00',who:'Tip'}]));assert.equal(ctx.lokalnyKonflikt('12:00','Tip'),true);storage.delete('astera.makietaRezerwacje');});
check('inactive team never falls back to full team',()=>{snapshot({salons:{SZ:{team:[['Kai','',false]],visits:[]}}});assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);snapshot();});
check('unknown snapshot and malformed storage fail closed',()=>{storage.delete('astera.dostepnosc');assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);storage.set('astera.dostepnosc','broken');assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);snapshot();});
check('date beyond fetched range fails closed',()=>{ctx.S.data='2027-01-15';assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);ctx.S.data='2026-09-20';});
check('production token cannot book from demo availability',()=>{ctx.token='TEST';assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);ctx.token='';});
check('stale or incomplete production read fails closed',()=>{snapshot({source:'arkusz',readAt:Date.now()-310000});assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);snapshot({source:'arkusz',incomplete:true});assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);snapshot();});
ctx.DATA.SZ.visits=[{id:'a',date:'2026-09-20',t:'15:00',end:'16:00',who:'Kai',status:'REZERWACJA'}];
check('editor checks selected day',()=>{assert.equal(ctx.r3cValidateMove({id:'x',date:'2026-09-21',duration:60},'Kai','15:00','SZ').ok,true);assert.equal(ctx.r3cValidateMove({id:'x',date:'2026-09-20',duration:60},'Kai','15:00','SZ').ok,false);});
check('editor rejects empty date and closing overlap',()=>{assert.equal(ctx.r3cValidateMove({duration:60},'Kai','12:00','SZ').ok,false);assert.equal(ctx.r3cValidateMove({date:'2026-09-20',duration:90},'Kai','22:00','SZ').ok,false);});
check('paired edit can ignore its own two occupied rows',()=>assert.equal(ctx.r3cValidateMove({id:'b',date:'2026-09-20',duration:60,groupIds:['a','b']},'Kai','15:00','SZ').ok,true));
ctx.DATA.SZ.visits=[{id:'REC-a',booking_id:'pair',date:'2026-09-20',who:'Kai',t:'12:00',end:'13:00',status:'REZERWACJA',localOnly:true},{id:'REC-b',booking_id:'pair',date:'2026-09-20',who:'Tip',t:'12:00',end:'13:00',status:'REZERWACJA',localOnly:true}];
check('pair change preserves both identities and therapists',()=>{ctx.DATA.SZ.visits[0].t='14:00';ctx.DATA.SZ.visits[0].status='ODWOŁANA';ctx.r1MarkLocalChange(ctx.DATA.SZ.visits[0]);assert.equal(ctx.DATA.SZ.visits[1].t,'14:00');assert.equal(ctx.DATA.SZ.visits[1].status,'ODWOŁANA');assert.equal(ctx.DATA.SZ.visits[1].id,'REC-b');assert.equal(ctx.DATA.SZ.visits[1].who,'Tip');});
check('local save persists cancellation without duplicate rows',()=>{assert.equal(ctx.r1SaveLocalState(),true);assert.equal(ctx.r1SaveLocalState(),true);const rows=JSON.parse(storage.get('astera.makietaRezerwacje'));assert.equal(rows.length,2);assert.equal(rows[1].status,'ODWOŁANA');assert.equal(rows[1].booking_id,'pair');});
check('invalid editor time rejected',()=>assert.equal(ctx.r3cValidateMove({date:'2026-09-20',duration:60},'Kai','12:99','SZ').ok,false));
check('local production edit invalidates availability until a new read',()=>{ctx.R1_PROD=true;ctx.r1MarkLocalChange(ctx.DATA.SZ.visits[0]);ctx.r1SaveAvailability();assert.equal(JSON.parse(storage.get('astera.dostepnosc')).incomplete,true);assert.equal(ctx.lokalnyKonflikt('12:00','Kai'),true);});
console.log(`${passed} scenarios passed; inline scripts parse successfully.`);
