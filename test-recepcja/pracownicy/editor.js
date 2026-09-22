'use strict';
window.StaffEditor=(()=>{
 const M=StaffSchedule;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 function read(){return window.StaffStore?StaffStore.read():M.read(localStorage);}
 function open(date,id,onSaved){
  let data;try{data=read();}catch(e){alert(e.message);return;}
  const person=M.staff.find(s=>s.id===id);if(!person||person.active===false||!M.validDate(date))return;
  const expectedVersion=window.StaffStore?StaffStore.version(date,id):data.revision;
  const saved=M.get(data,date,id),dialog=el('dialog',undefined,'staff-editor'),form=el('form'),heading=el('h2',person.name+' · '+date),statusLabel=el('label','Obecność'),status=el('select'),rows=el('div'),error=el('p',undefined,'staff-error'),actions=el('div',undefined,'staff-actions');
  error.setAttribute('role','alert');status.name='status';status.setAttribute('aria-label','Obecność');
  for(const [v,label]of [['','Wybierz'],['WORK','Pracuje'],['OFF','Wolne']]){const o=el('option',label);o.value=v;status.append(o);}status.value=saved?.status||'';statusLabel.append(status);
  function addRow(x={salon:person.home,start:'',end:''}){const row=el('div',undefined,'staff-interval');const salon=el('select');salon.setAttribute('aria-label','Salon zmiany');for(const [value,name]of [['ZW','Zwierzyniecka'],['SZ','Szewska']]){const o=el('option',name);o.value=value;salon.append(o);}salon.value=x.salon;row.append(salon);
   for(const [name,label]of [['start','Od'],['end','Do']]){const input=el('input');input.type='time';input.name=name;input.value=x[name];input.required=true;input.setAttribute('aria-label',label);row.append(input);}
   const remove=el('button','Usuń godziny');remove.type='button';remove.onclick=()=>row.remove();row.append(remove);rows.append(row);
  }
  (saved?.intervals||[]).forEach(addRow);
  const add=el('button','＋ Dodaj godziny / po przerwie');add.type='button';add.onclick=()=>addRow();
  function state(){rows.hidden=add.hidden=status.value!=='WORK';rows.querySelectorAll('input').forEach(i=>i.disabled=rows.hidden);if(status.value==='WORK'&&!rows.children.length)addRow();}
  status.onchange=state;state();
  const save=el('button','Zapisz grafik', 'staff-primary'),cancel=el('button','Anuluj');cancel.type='button';cancel.onclick=()=>dialog.close();actions.append(cancel,save);
  const conflicts=el('p',undefined,'staff-warning');let availability;try{if(!window.StaffStore||StaffStore.mode()==='LOCAL')availability=JSON.parse(localStorage.getItem('astera.dostepnosc')||'null');}catch{}
  const visits=Object.values(availability?.salons||{}).flatMap(s=>s.visits||[]).filter(v=>v.date===date&&v.who===id&&v.status!=='ODWOŁANA');
  if(visits.length)conflicts.textContent='W tym dniu jest '+visits.length+' wpisów w ostatnio odczytanym grafiku. Zmiana pracy nie przenosi ani nie odwołuje wizyt.';
  form.append(heading,el('p',window.StaffStore&&StaffStore.mode()!=='LOCAL'?'Zapis w bazie. Zmiana dotyczy tylko tego dnia; wizyty pozostają bez zmian.':'Zapis lokalny na tym urządzeniu. Podłączenie AWS jest kolejnym krokiem.','staff-muted'),statusLabel,rows,add,conflicts,error,actions);dialog.append(form);document.body.append(dialog);dialog.addEventListener('pointerdown',e=>e.stopPropagation());dialog.onclose=()=>dialog.remove();
  form.onsubmit=async e=>{e.preventDefault();error.textContent='';const intervals=status.value==='WORK'?[...rows.children].map(row=>({salon:row.querySelector('select').value,start:row.querySelector('[name=start]').value,end:row.querySelector('[name=end]').value})):[];
   save.disabled=true;cancel.disabled=true;
   try{const day={status:status.value,intervals};const result=window.StaffStore?await StaffStore.save(date,id,day,expectedVersion):M.save(localStorage,date,id,day,expectedVersion);dialog.close();window.dispatchEvent(new CustomEvent('staff-schedule-changed',{detail:result}));onSaved?.(result);}catch(err){error.textContent=err.message;}finally{save.disabled=false;cancel.disabled=false;}};
  dialog.showModal();
 }
 function day(container,date,salon,onSaved){container.replaceChildren();let data;try{data=read();}catch(e){container.append(el('p',e.message,'staff-error'));return;}
  container.append(el('p','Grafik na '+date+' · '+(salon==='ZW'?'Zwierzyniecka':'Szewska'),'staff-muted'));
  M.staff.forEach(s=>{const row=el('div',undefined,'staff-day-row');row.append(el('strong',s.name),el('span',M.label(M.get(data,date,s.id),salon)));const b=el('button','Edytuj');b.setAttribute('aria-label','Edytuj grafik '+s.name);b.disabled=s.active===false;b.onclick=()=>open(date,s.id,onSaved);row.append(b);container.append(row);});
 }
 return {open,day,read};
})();
