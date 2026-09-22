'use strict';
// Transitional read-only schedule connection. Booking writes still use the existing bridge.
window.CalendarStaff=(()=>{
 const M=StaffSchedule,aws='https://core.thaimaliwan.pl',pages=location.hostname==='astera260.github.io';
 let mode=pages?'AWS':'LOCAL',ready=false,cache=null,date='',loadedAt=0,generation=0,pending='',nextRetry=0,error='',getDate=()=>'',onChange=()=>{},restoreContext=()=>{};
 let bar,message,login,retry;
 const api=path=>(pages?aws:'')+path;
 function notify(){if(message)message.textContent=mode==='LOCAL'?'Grafik lokalny — wersja testowa.':error||(pending?'Pobieranie godzin pracy…':cache?(mode==='TEST_DATABASE'?'Grafik testowy · ':'Grafik pracowników: AWS · ')+date:'Połącz grafik pracowników z AWS.');if(login)login.hidden=mode!=='AWS'||ReceptionAuth.authenticated();onChange();}
 async function init(){
  if(!pages){const r=await fetch('/api/reception/staff/config',{cache:'no-store'});if(r.status===404){ready=true;notify();return;}if(!r.ok)throw Error('Nie udało się sprawdzić źródła grafiku.');const c=await r.json();if(c.mode!=='TEST_DATABASE')throw Error('Nieznane źródło grafiku.');mode='TEST_DATABASE';}
  if(mode==='AWS'){await ReceptionAuth.initialize();restoreContext();}ready=true;
  if(mode==='AWS'&&!ReceptionAuth.authenticated()){error='Zaloguj się, aby wczytać godziny pracy z AWS.';notify();return;}
  ensure(getDate(),true);
 }
 async function ensure(wanted,force=false){
  if(mode==='LOCAL'||!ready||!M.validDate(wanted)||(mode==='AWS'&&!ReceptionAuth.authenticated()))return;
  if(pending===wanted||(!force&&wanted===date&&Date.now()<nextRetry))return;
  const turn=++generation;pending=wanted;date=wanted;cache=null;loadedAt=0;error='';nextRetry=Date.now()+60000;notify();
  try{
   const r=await fetch(api('/api/reception/staff/schedule?')+new URLSearchParams({from:wanted,to:wanted,test:mode==='TEST_DATABASE'?'true':'false'}),{cache:'no-store',headers:mode==='AWS'?ReceptionAuth.headers():{}});
   const data=await r.json();if(turn!==generation)return;
   if(!r.ok){if(r.status===401)ReceptionAuth.clear();throw Error(data.error||'Nie udało się odczytać godzin pracy.');}
   if(data.from!==wanted||data.to!==wanted||!Array.isArray(data.staff)||!Array.isArray(data.days))throw Error('Niepełny odczyt grafiku.');
   const people=data.staff;const ids=new Set();for(const p of people){if(!p.id||!p.name||ids.has(p.id)||p.isTest!==(mode==='TEST_DATABASE'))throw Error('Nieprawidłowa lista pracowników.');ids.add(p.id);}
   const next=M.empty();next.days[wanted]={};for(const d of data.days){if(d.date!==wanted||!ids.has(d.staffId)||next.days[wanted][d.staffId])throw Error('Nieprawidłowy dzień pracy.');next.days[wanted][d.staffId]=M.validate(d);}
   M.staff.splice(0,M.staff.length,...people);cache=next;loadedAt=Date.now();error='';
  }catch(e){if(turn!==generation)return;cache=null;error=e.message||'Grafik AWS niedostępny.';}
  finally{if(turn===generation){pending='';notify();}}
 }
 function read(wanted){if(mode==='LOCAL')return M.read(localStorage);if(!cache||date!==wanted||Date.now()-loadedAt>60000)throw Error(error||'Poczekaj na aktualny odczyt grafiku AWS.');return cache;}
 function coverage(wanted,visits){try{read(wanted);}catch{return false;}if(mode==='LOCAL')return true;return !visits.some(v=>v.date===wanted&&v.status!=='ODWOŁANA'&&!M.person(v.who));}
 function mount(get,onUpdate,onRestore=()=>{}){getDate=get;onChange=onUpdate;restoreContext=onRestore;bar=document.createElement('div');bar.className='staff-calendar-connection';message=document.createElement('span');message.setAttribute('role','status');login=document.createElement('button');login.type='button';login.textContent='Zaloguj grafik AWS';login.onclick=()=>{restoreContext('save');ReceptionAuth.login().catch(e=>{error=e.message;notify();});};retry=document.createElement('button');retry.type='button';retry.textContent='Odśwież godziny pracy';retry.onclick=()=>{if(ready)ensure(getDate(),true);else init().catch(e=>{error=e.message;notify();});};const link=document.createElement('a');link.href=aws+'/test-recepcja/pracownicy/';link.textContent='Pracownicy';bar.append(message,login,retry,link);(document.querySelector('.ui-r1')||document.body).prepend(bar);
  window.addEventListener('focus',()=>ensure(getDate(),true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensure(getDate(),true);});setInterval(()=>{if(!document.hidden)ensure(getDate());},15000);
  init().catch(e=>{error=e.message;notify();});
 }
 return {mount,ensure,read,coverage,mode:()=>mode};
})();
