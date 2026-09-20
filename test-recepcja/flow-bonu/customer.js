/* Existing customer calendar. No receptionist controls or administrative token. */
(() => {
  'use strict';
  const API='https://script.google.com/macros/s/AKfycbz1DIfrEuALN3wJ0MFJ_bmoWHFbWg3FKQH-OGvAGZSPOa5ej52XfbvrH-1tdTxxHy90DA/exec';
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const state={month:today.slice(0,7),slots:[],date:null,slot:null,number:'',salon:'',request:null,busy:false,epoch:0,booking:null};
  function bounds(){const [y,m]=state.month.split('-').map(Number);return {from:state.month+'-01',to:state.month+'-'+new Date(y,m,0).getDate()};}
  const messages={BON_NIEDOSTEPNY:'Nie znaleziono ważnego bonu w wybranym salonie. Sprawdź numer i salon.',BON_MA_REZERWACJE:'Ten bon ma już przypisaną wizytę. W sprawie zmiany skontaktuj się z recepcją.',BON_WYMAGA_RECEPCJI:'Ten bon wymaga ustalenia usługi z recepcją. Skontaktuj się z salonem.',TERMIN_ZAJETY:'Ten termin nie jest już dostępny. Sprawdź ponownie wolne godziny.',NIEKOMPLETNE_DANE:'Wpisz imię i nazwisko oraz poprawny numer telefonu.',ZAJETE_SPROBUJ_PONOWNIE:'Trwa inny zapis. Spróbuj ponownie za chwilę.'};
  function notice(text){$('#voucherResult').className='result warn';$('#voucherResult').textContent=text;}
  function hideSelection(){state.slot=null;state.request=null;$('#customerDetails').classList.add('hidden');$('#customerState').textContent='Wybierz dzień i godzinę z udostępnionych terminów.';}
  function invalidate(){state.epoch++;state.number='';state.slots=[];state.booking=null;hideSelection();$('#slotChoices').classList.add('hidden');$('#bookingConfirmation').classList.add('hidden');$('#voucherResult').classList.add('hidden');}
  function busy(value){state.busy=value;['checkVoucher','confirmBooking','prevMonth','nextMonth','voucherInput','salonInput','customerName','customerPhone'].forEach(id=>$('#'+id).disabled=value);}
  async function api(payload){const c=new AbortController(),timer=setTimeout(()=>c.abort(),45000);try{const response=await fetch(API,{method:'POST',body:new URLSearchParams({action:'customerVoucher',...payload}),signal:c.signal});if(!response.ok)throw Error('NETWORK');return await response.json();}finally{clearTimeout(timer);}}
  async function check(){
    if(state.busy)return;const epoch=++state.epoch;hideSelection();state.booking=null;$('#bookingConfirmation').classList.add('hidden');$('#slotChoices').classList.add('hidden');
    state.number=$('#voucherInput').value.trim();state.salon=$('#salonInput').value;
    if(!state.number){notice('Wpisz numer z bonu.');return;}busy(true);notice('Sprawdzam bon i wolne terminy…');
    try{const r=await api({operation:'availability',number:state.number,salon:state.salon,...bounds()});if(epoch!==state.epoch)return;
      if(!r.ok){state.slots=[];notice(messages[r.error]||'Nie udało się sprawdzić dostępności. Spróbuj ponownie.');return;}
      state.slots=r.slots;state.date=null;$('#voucherResult').className='result ok';$('#voucherResult').textContent=r.service+' · '+r.minutes+' min · bon ważny do '+r.validTo;
      $('#slotChoices').classList.remove('hidden');renderMonth();
    }catch(e){notice('Nie udało się połączyć z kalendarzem. Spróbuj ponownie.');}finally{busy(false);}
  }
  function renderMonth(){const [y,m]=state.month.split('-').map(Number);$('#monthTitle').textContent=new Intl.DateTimeFormat('pl-PL',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));
    document.querySelector('.calendar-title small').textContent=state.slots.length+' wolnych terminów';
    let html=['Pn','Wt','Śr','Cz','Pt','So','Nd'].map(d=>'<div class="weekday">'+d+'</div>').join('');
    for(let i=0;i<(new Date(y,m-1,1).getDay()+6)%7;i++)html+='<div></div>';
    for(let n=1;n<=new Date(y,m,0).getDate();n++){const d=state.month+'-'+String(n).padStart(2,'0'),available=state.slots.some(s=>s.date===d);html+='<button class="day '+(available?'available ':'')+(state.date===d?'selected':'')+'" '+(available?'data-date="'+d+'"':'disabled')+'>'+n+'</button>';}
    $('#monthCalendar').innerHTML=html;$('#monthCalendar').querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{if(state.busy)return;state.date=b.dataset.date;hideSelection();renderMonth();});renderSlots();
  }
  function renderSlots(){const available=state.slots.filter(s=>s.date===state.date);$('.hours-title').textContent=state.date?'Wolne godziny · '+state.date:'Wolne godziny';
    $('#customerSlots').innerHTML=!state.date?'<p class="empty">'+(state.slots.length?'Wybierz dzień oznaczony zieloną kropką.':'Recepcja nie udostępniła jeszcze terminu pasującego do tego bonu w tym miesiącu.')+'</p>':available.map(s=>'<button class="choice '+(state.slot?.id===s.id?'selected':'')+'" data-slot="'+esc(s.id)+'"><b>'+esc(s.start)+' · '+esc(s.therapist)+'</b><small>'+esc(s.minutes)+' min · '+esc(s.salon==='ZW'?'Zwierzyniecka':'Szewska')+'</small></button>').join('');
    $('#customerSlots').querySelectorAll('[data-slot]').forEach(b=>b.onclick=()=>{if(state.busy)return;state.slot=state.slots.find(s=>s.id===b.dataset.slot);state.request=null;$('#customerState').textContent=state.slot.date+' · '+state.slot.start+'–'+state.slot.end+' · '+state.slot.therapist;$('#customerDetails').classList.remove('hidden');renderSlots();});
  }
  async function reserve(){if(state.busy||!state.slot)return;const name=$('#customerName').value.trim(),phone=$('#customerPhone').value.trim();if(!name||phone.replace(/\D/g,'').length<9){notice(messages.NIEKOMPLETNE_DANE);return;}
    const signature=JSON.stringify([state.number,state.salon,state.slot.id,name,phone]);if(!state.request||state.request.signature!==signature)state.request={id:'CUSTOMER-'+crypto.randomUUID(),signature};
    busy(true);notice('Zapisuję wizytę…');
    try{const r=await api({operation:'reserve',number:state.number,salon:state.salon,slot_id:state.slot.id,request_id:state.request.id,name,phone,...bounds()});
      if(!r.ok){notice(r.uncertain?'Nie otrzymano potwierdzenia. Kliknij ponownie „Potwierdź rezerwację”, zachowując te same dane — system sprawdzi poprzednią próbę.':messages[r.error]||'Nie udało się zapisać wizyty. Sprawdź bon ponownie.');return;}
      if(r.status!=='CONFIRMED'||!r.booking_id)throw Error('NO_CONFIRMATION');
      state.booking=r;$('#customerDetails').classList.add('hidden');$('#slotChoices').classList.add('hidden');$('#voucherResult').classList.add('hidden');$('#customerState').textContent='Wizyta została zapisana.';
      $('#bookingConfirmation').className='booking-card';$('#bookingConfirmation').innerHTML='<strong>Rezerwacja potwierdzona ✓</strong><p>'+esc(r.date)+' · '+esc(r.start)+'–'+esc(r.end)+'</p><p>Do zapłaty: 0 zł — opłacono bonem.</p><p>Numer rezerwacji: '+esc(r.booking_id)+'</p><button class="outline" id="cancelBooking">Odwołaj wizytę</button>';
      $('#cancelBooking').onclick=cancel;
    }catch(e){notice('Nie otrzymano potwierdzenia zapisu. Ponów potwierdzenie z tymi samymi danymi; nie wybieraj nowego terminu.');}finally{busy(false);}
  }
  async function cancel(){if(state.busy||!state.booking)return;if(!confirm('Odwołać tę wizytę?'))return;busy(true);
    try{const payload={operation:'cancel',number:state.number,salon:state.salon,booking_id:state.booking.booking_id};let r=await api(payload);
      if(r.error==='POZNE_ODWOLANIE'){if(!confirm('Do wizyty zostało mniej niż 24 godziny. Odwołanie oznacza utratę bonu. Czy odwołać?'))return;r=await api({...payload,accept_forfeit:'1'});}
      if(!r.ok){notice('Nie otrzymano potwierdzenia odwołania. Spróbuj ponownie lub skontaktuj się z recepcją.');return;}
      $('#customerState').textContent='Wizyta została odwołana.';
      $('#bookingConfirmation').textContent=r.forfeited?'Wizyta odwołana po terminie. Bon zostanie zużyty po planowanym końcu wizyty.':'Wizyta odwołana. Bon pozostaje dostępny do ponownej rezerwacji.';state.booking=null;
    }catch(e){notice('Nie udało się potwierdzić odwołania. Spróbuj ponownie.');}finally{busy(false);}
  }
  function shift(delta){if(state.busy)return;const [y,m]=state.month.split('-').map(Number),d=new Date(y,m-1+delta,1);state.month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');check();}
  $('#voucherInput').oninput=invalidate;$('#salonInput').onchange=invalidate;$('#checkVoucher').onclick=check;$('#confirmBooking').onclick=reserve;$('#prevMonth').onclick=()=>shift(-1);$('#nextMonth').onclick=()=>shift(1);
})();
