(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StaffSchedule=api;})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const KEY='astera.staffSchedule.v1';
 const staff=[['Maliwan','ZW'],['Sumalee','ZW'],['Khanjana','ZW'],['Tip','ZW'],['Cholthida','SZ'],['Butsakorn','SZ'],['Kai','SZ']].map(([id,home])=>({id,name:id,home}));
 const minute=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
 function validDate(d){return /^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number(d.slice(0,4))>=2000&&Number(d.slice(0,4))<=2100&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
 function validate(day){
  if(!day||!['OFF','WORK'].includes(day.status)||!Array.isArray(day.intervals)||day.intervals.length>8)throw Error('Sprawdź status i godziny pracy.');
  if(day.status==='OFF'&&day.intervals.length||day.status==='WORK'&&!day.intervals.length)throw Error('Dzień pracy wymaga godzin; dzień wolny nie może ich zawierać.');
  const intervals=day.intervals.map(x=>{if(!['ZW','SZ'].includes(x.salon)||!Number.isFinite(minute(x.start))||!Number.isFinite(minute(x.end))||minute(x.end)<=minute(x.start))throw Error('Podaj salon oraz poprawny początek i koniec pracy w tym dniu.');return {salon:x.salon,start:x.start,end:x.end};}).sort((a,b)=>minute(a.start)-minute(b.start));
  for(let i=1;i<intervals.length;i++)if(minute(intervals[i].start)<minute(intervals[i-1].end))throw Error('Godziny pracy tej samej osoby nakładają się, także między salonami.');
  return {status:day.status,intervals};
 }
 function empty(){return {version:1,revision:0,days:{}};}
 function read(storage){const raw=storage.getItem(KEY);if(!raw)return empty();let data;try{data=JSON.parse(raw);}catch{throw Error('Nie można odczytać zapisanego grafiku. Nie nadpisano danych.');}
  if(data.version!==1||!Number.isSafeInteger(data.revision)||data.revision<0||!data.days||typeof data.days!=='object'||Array.isArray(data.days))throw Error('Nieprawidłowy zapis grafiku.');
  for(const [date,rows]of Object.entries(data.days)){if(!validDate(date)||!rows||typeof rows!=='object'||Array.isArray(rows))throw Error('Nieprawidłowa data grafiku.');for(const [id,day]of Object.entries(rows)){if(!staff.some(s=>s.id===id))throw Error('Nieznany pracownik w grafiku.');validate(day);}}
  return data;
 }
 function get(data,date,id){return data.days[date]?.[id]||null;}
 function save(storage,date,id,day,revision){if(!validDate(date)||!staff.some(s=>s.id===id))throw Error('Wybierz datę i pracownika.');const clean=validate(day),data=read(storage);if(data.revision!==revision)throw Error('Grafik zmienił się w innym oknie. Otwórz formularz ponownie.');data.days[date]??={};data.days[date][id]=clean;data.revision++;storage.setItem(KEY,JSON.stringify(data));return data;}
 function onDay(data,date,salon){return staff.filter(s=>s.active!==false&&get(data,date,s.id)?.intervals.some(x=>x.salon===salon));}
 function person(value){const norm=s=>String(s||'').trim().toLowerCase();const matches=staff.filter(s=>s.id===value||norm(s.name)===norm(value));return matches.length===1?matches[0]:null;}
 function samePerson(a,b){const p=person(a),q=person(b);return p&&q?p.id===q.id:String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();}
 function covers(data,date,salon,id,start,end){const a=minute(start),b=minute(end);if(!validDate(date)||!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return false;const p=person(id);if(!p||p.active===false)return false;return (get(data,date,p.id)?.intervals||[]).some(x=>x.salon===salon&&minute(x.start)<=a&&minute(x.end)>=b);}
 function available(data,date,salon,id,start,end,visits=[],ignore=[]){return covers(data,date,salon,id,start,end)&&!visits.some(v=>!ignore.includes(v.id)&&v.date===date&&v.who===id&&v.status!=='ODWOŁANA'&&minute(start)<minute(v.end)&&minute(end)>minute(v.t));}
 function label(day,salon){if(!day)return 'Nieustalone';if(day.status==='OFF')return 'Wolne';const intervals=day.intervals.filter(x=>!salon||x.salon===salon);return intervals.length?intervals.map(x=>x.salon+' '+x.start+'–'+x.end).join(' · '):'Drugi salon';}
 return {KEY,staff,person,samePerson,minute,validDate,validate,empty,read,get,save,onDay,covers,available,label};
});
