'use strict';
// Access tokens stay in memory. Only the short-lived, single-use PKCE transaction
// is stored in sessionStorage so the redirect can complete. No customer cache.
window.ReceptionAuth=(()=>{
 const requested=document.currentScript?.dataset.config;
 const calendarConfig=/^https:\/\/core\.thaimaliwan\.pl\/api\/reception\/calendar\/config\?screen=(calendar|manual)$/.test(requested||'');
 const configEndpoint=calendarConfig?requested:(requested==='/api/reception/staff/config'?requested:'/api/reception/config');
 let config=null,accessToken=null,ready=false;
 const key='astera-reception-pkce';
 const encode=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
 async function initialize(){
  if(ready)return;
  const response=await fetch(configEndpoint,{credentials:'same-origin',cache:'no-store'});
  if(response.status===404){ready=true;return;} // Existing synthetic test service.
  if(!response.ok)throw Error('Nie udało się sprawdzić logowania.');
  config=(await response.json()).auth;
  if(!config||config.type!=='COGNITO_PKCE'||new URL(config.redirectUri).origin!==location.origin||!config.domain.startsWith('https://'))throw Error('Nieprawidłowa konfiguracja logowania.');
  const params=new URLSearchParams(location.search);
  if(params.has('code')||params.has('error')){
   const saved=JSON.parse(sessionStorage.getItem(key)||'null');sessionStorage.removeItem(key);
   history.replaceState(null,'',location.pathname);
   if(!saved||Date.now()-saved.at>600000||saved.state!==params.get('state'))throw Error('Logowanie wygasło. Rozpocznij ponownie.');
   if(calendarConfig&&saved?.returnTo){const back=new URL(saved.returnTo,location.origin);if(back.origin===location.origin&&['/thaimaliwan/test-recepcja/','/thaimaliwan/test-recepcja/index.html','/thaimaliwan/test-recepcja/rezerwacje/'].includes(back.pathname))history.replaceState(null,'',back.pathname+back.search+back.hash);}
   if(params.has('error'))throw Error('Logowanie nie zostało zakończone.');
   const result=await fetch(config.domain+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.clientId,code:params.get('code'),redirect_uri:config.redirectUri,code_verifier:saved.verifier})});
   if(!result.ok)throw Error('Nie udało się potwierdzić logowania.');
   const tokens=await result.json();if(!tokens.access_token)throw Error('Brak potwierdzonej sesji.');accessToken=tokens.access_token;
  }
  ready=true;
 }
 async function login(){
  if(!config)await initialize();if(!config)return;
  const verifier=random(),state=random();sessionStorage.setItem(key,JSON.stringify({verifier,state,at:Date.now(),...(calendarConfig?{returnTo:location.pathname+location.search+location.hash}:{})}));
  const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const url=new URL(config.domain+'/oauth2/authorize');url.search=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:config.redirectUri,scope:'openid',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();location.assign(url);
 }
 function logout(){accessToken=null;sessionStorage.removeItem(key);if(config){const url=new URL(config.domain+'/logout');url.search=new URLSearchParams({client_id:config.clientId,logout_uri:config.redirectUri});location.assign(url);}else location.reload();}
 return {initialize,login,logout,headers:()=>accessToken?{Authorization:'Bearer '+accessToken}:{},clear:()=>{accessToken=null;},configured:()=>!!config,authenticated:()=>!!accessToken};
})();
