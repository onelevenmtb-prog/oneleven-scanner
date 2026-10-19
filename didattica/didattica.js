/* ONELEVEN MTB - DIDATTICA V3.3 - VERSIONE OPERATIVA PRONTA PER RILASCIO.
   Registrazione solo nella pagina HTTPS ufficiale, dopo autorizzazione Google.
   Invii sospesi: ID stabile, verifica server, ripresa con stesso ID.
   Non memorizza token o testi didattici sul dispositivo.
   Il resto dello scanner ("Varie ed eventuali", presenze, pagamenti) resta invariato. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  // Si abilita solo nell'URL GitHub Pages ufficiale dopo il rilascio su main.
  // Il controllo di sicurezza effettivo e' sempre sul server Apps Script.
  const REGISTRAZIONE_ABILITATA=location.protocol==='https:' &&
    location.hostname==='onelevenmtb-prog.github.io' &&
    /^\/oneleven-scanner\/didattica\/(?:index\.html)?$/.test(location.pathname);
  const PENDING_PREFIX='oneleven_didattica_v33_pending_';
  let pending=null, inInvio=false, completata=false, idCorrente=null, ricompilazioneSospesa=false;
  function registraErrore(s){$('sendState').textContent=s;}

  const tipi=['CLUB','IND','COLL >2','COLL <2','PROVA','DAILY','OUT >2','OUT <2'];
  // Indirizzo pubblico dell'API, non contiene password o token personali.
  const API_URL='https://script.google.com/macros/s/AKfycby3R-1Nls1V3JCD-FMQWw6Su10NM_cuqB4_uIPjJ3-WMwspP5XiEaaXnP79F2Qt8OXz/exec';
  const hashParams=new URLSearchParams(location.hash.replace(/^#/,''));
  const token=hashParams.get('token')||'';
  // Separazione degli ID sospesi per token intero, senza salvarlo in chiaro.
  // L'hash non sostituisce mai la convalida del token effettuata da Google.
  function chiaveAccesso(s){
    let h1=2166136261, h2=0x811c9dc5;
    for(let i=0;i<s.length;i++){
      h1=Math.imul(h1^s.charCodeAt(i),16777619);
      h2=Math.imul(h2^(s.charCodeAt(i)+i),16777619);
    }
    return (h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0');
  }
  const PENDING_KEY=PENDING_PREFIX+chiaveAccesso(token);
  // Rimuove il token dalla barra indirizzi appena letto; rimane solo in memoria.
  if(token){
    try { history.replaceState(null,'',location.pathname+location.search); }catch(_){ /* file:// */ }
  }
  const avviso=document.querySelector('.notice[role="status"]');
  // Mostra caricamento, errori e invii sospesi; nasconde solo la conferma positiva.
  function mostraAvviso(testo,visibile=true){
    avviso.textContent=testo;
    avviso.hidden=!visibile;
  }
  // Interfaccia coerente fra anteprima locale (senza invio) e sito pubblicato.
  const intro=document.querySelector('#stage-0 .sub');
  const riepilogo=document.querySelector('#stage-2 .sub');
  const avvisoRiepilogo=document.querySelector('#stage-2 .notice.warning');
  const footer=document.querySelector('footer span:last-child');
  const flag=document.querySelector('.flag');
  if(flag)flag.textContent=REGISTRAZIONE_ABILITATA?'DIDATTICA':'ANTEPRIMA LOCALE';
  if(intro)intro.textContent='Scegli sede, attività, orario e gruppo. Il maestro viene identificato dal suo accesso personale. Non inserire dati sensibili degli allievi.';
  if(riepilogo)riepilogo.textContent='Controlla tutti i dati: la registrazione sara’ effettiva solo dopo la conferma da Google.';
  if(avvisoRiepilogo)avvisoRiepilogo.textContent=REGISTRAZIONE_ABILITATA
    ?'L’attività sarà registrata nel REGISTRO DIDATTICA. In caso di interruzione non iniziare un secondo invio: verifica l’ID sospeso.'
    :'ANTEPRIMA LOCALE: invio disabilitato. Per registrare apri la Didattica dal tuo scanner sul sito ufficiale.';
  if(footer)footer.textContent=REGISTRAZIONE_ABILITATA?'Registro didattico attivo':'Anteprima locale: nessun invio';
  if(!token)mostraAvviso('Accesso maestro mancante. Apri questa pagina dal tuo scanner personale per leggere i gruppi e registrare le attività.');
  // Il catalogo incorporato serve SOLO a continuare le prove offline senza token.
  // Nell'accesso autenticato il catalogo deve arrivare da ANAGRAFICA GRUPPI.
  let gruppi=token?[]:(window.ONELEVEN_GRUPPI||[]);
  let stage=0;
  // Non salvare mai il token o il testo didattico nella memoria persistente.
  try{const z=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');
      if(z && /^D-[A-Za-z0-9_-]{16,90}$/.test(z.idDidattica)) pending=z;
  }catch(_){/* storage bloccato: l'invio verra' negato */}


  function leggiJsonp(params,callback){
    const callbackName='onelevenDidV3Cb'+Date.now()+'_'+String(++leggiJsonp.count);
    const script=document.createElement('script');
    const timer=setTimeout(function(){chiudi();callback(new Error('Risposta Google non arrivata'));},20000);
    let finito=false;
    function chiudi(){
      if(finito)return false;
      finito=true;clearTimeout(timer);
      try{delete window[callbackName];}catch(_){window[callbackName]=undefined;}
      script.remove();
      return true;
    }
    window[callbackName]=function(response){if(chiudi())callback(null,response);};
    script.onerror=function(){if(chiudi())callback(new Error('Collegamento Google non riuscito'));};
    const query=new URLSearchParams(Object.assign({},params,{token:token,callback:callbackName}));
    script.src=API_URL+'?'+query.toString();
    document.body.appendChild(script);
  }
  leggiJsonp.count=0;

  function caricaGruppiGoogle(){
    if(!token)return; // Anteprima locale senza accesso, sempre non operativa.
    mostraAvviso(REGISTRAZIONE_ABILITATA
      ?'Verifica accesso e gruppi in corso. Solo collaudo locale con attività fittizia.'
      :'Verifica dell’accesso del maestro e lettura gruppi da Google in corso. Salvataggio disabilitato.');
    leggiJsonp({azione:'didatticaElencoGruppiV3'},function(errore,risposta){
      if(errore||!risposta||risposta.ok!==true||!Array.isArray(risposta.gruppi)){
        mostraAvviso('Accesso o lettura gruppi non disponibile. Non è possibile usare i gruppi online. Nessun dato è stato inviato.');
        return;
      }
      const ids=new Set(),valide=[];
      for(const r of risposta.gruppi){
        if(!r||typeof r.id!=='string'||typeof r.nome!=='string'||
           !/^(MFZ|PIN|OUT)-[A-Z0-9-]{1,70}$/.test(r.id)||
           !['MFZ','PIN','OUT'].includes(r.sede)||!r.id.startsWith(r.sede+'-')||
           !r.nome.trim()||ids.has(r.id)){
          mostraAvviso('Anagrafica gruppi inattesa. Nessuna operazione consentita.');
          return;
        }
        ids.add(r.id);
        valide.push({id:r.id,sede:r.sede,categoria:String(r.categoria||''),nome:r.nome,attivo:true});
      }
      if(valide.length===0||valide.length>100){
        mostraAvviso('Anagrafica gruppi vuota o inattesa. Nessuna operazione consentita.');
        return;
      }
      gruppi=valide;
      groups();
      $('fascicoloLink').hidden=false;
      $('fascicoloLink').href='fascicolo.html#token='+encodeURIComponent(token);
      aggiornaRegistrazione();
      if(pending) verificaPending();
      mostraAvviso('Accesso verificato: '+valide.length+' gruppi attivi letti da Google. '+
        (REGISTRAZIONE_ABILITATA
          ? (pending?'Invio precedente in verifica: non creare un altro ID.':'Registrazione didattica disponibile.')
          :'Anteprima locale: salvataggio disabilitato.'), !REGISTRAZIONE_ABILITATA || !!pending);
    });
  }
  function dateToday(){
    const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function validDate(s){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;
    const p=s.split('-').map(Number);const d=new Date(p[0],p[1]-1,p[2]);
    return d.getFullYear()===p[0]&&d.getMonth()+1===p[1]&&d.getDate()===p[2];
  }
  function addOption(sel,value,label){const opt=document.createElement('option');opt.value=value;opt.textContent=label;sel.appendChild(opt);}
  function populate(){
    tipi.forEach(v=>addOption($('attivita'),v,v));
    for(let h=8;h<=18;h++)for(const m of (h===18?[0]:[0,30])){
      const t=String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');addOption($('ora'),t,t);
    }
    $('lessonDate').value=dateToday();
  }
  function outdoorChange(){
    const vis=$('sede').value==='OUT';
    $('outdoorBox').classList.toggle('hidden',!vis);
    if(!vis)$('localitaOutdoor').value='';
  }
  function groups(){
    outdoorChange();
    const sede=$('sede').value,sel=$('gruppo');sel.replaceChildren();
    const catalogoDisponibile=!token||gruppi.length>0;
    addOption(sel,'',sede?'Seleziona il gruppo':'Seleziona prima la sede');
    sel.disabled=!sede||!catalogoDisponibile;
    if(sede&&catalogoDisponibile){
      gruppi.filter(x=>x.sede===sede&&x.attivo).forEach(g=>addOption(sel,g.id,g.nome));
      addOption(sel,'OCCASIONALE','Gruppo occasionale');
    }
    $('occasionaleBox').classList.add('hidden');$('descrizioneOccasionale').value='';
  }
  function occasionale(){
    const occ=$('gruppo').value==='OCCASIONALE';$('occasionaleBox').classList.toggle('hidden',!occ);
    if(!occ)$('descrizioneOccasionale').value='';
  }
  function data(){
    const id=$('gruppo').value,g=gruppi.find(x=>x.id===id);
    const desc=$('descrizioneOccasionale').value.trim();
    return {data:$('lessonDate').value,sede:$('sede').value,localitaOutdoor:$('sede').value==='OUT'?$('localitaOutdoor').value.trim():'',attivita:$('attivita').value,orario:$('ora').value,
      idGruppo:id,gruppo:id==='OCCASIONALE'?'Gruppo occasionale: '+desc:(g?g.nome:''),
      descrizioneOccasionale:id==='OCCASIONALE'?desc:'',
      didattica:$('didattica').value.replace(/\r\n?/g,'\n').trim()};
  }
  function validLesson(){
    const d=data();let msg='';
    if(!validDate(d.data))msg='Seleziona una data valida.';
    else if(!['MFZ','PIN','OUT'].includes(d.sede))msg='Seleziona una sede.';
    else if(token&&!gruppi.length)msg='Attendi la verifica dell’accesso e la lettura gruppi da Google.';
    else if(d.sede==='OUT'&&(!d.localitaOutdoor||d.localitaOutdoor.length>140))msg='Indica la località della lezione Outdoor (massimo 140 caratteri).';
    else if(!tipi.includes(d.attivita))msg='Seleziona il tipo di attività.';
    else if(!Array.from($('ora').options).some(o=>o.value===d.orario&&!!o.value))msg='Seleziona un orario.';
    else if(d.idGruppo==='OCCASIONALE'&&(!d.descrizioneOccasionale||d.descrizioneOccasionale.length>120))msg='Descrivi il gruppo occasionale (massimo 120 caratteri).';
    else if(d.idGruppo!=='OCCASIONALE'&&!gruppi.some(g=>g.id===d.idGruppo&&g.sede===d.sede&&g.attivo))msg='Scegli un gruppo valido per la sede.';
    $('stage0Error').textContent=msg;return !msg;
  }
  function validText(){
    const t=data().didattica;
    $('stage1Error').textContent=(!t||t.length>2000)?'Inserisci l’attività didattica (1-2000 caratteri).':'';
    return !!t&&t.length<=2000;
  }
  function lessonLabel(){const d=data();return [d.data,d.sede==='MFZ'?'My Fly Zone':(d.sede==='PIN'?'Pineta Sacchetti':'Outdoor'),d.attivita,d.orario,d.gruppo].filter(Boolean).join(' · ');}
  function row(label,value){
    const p=document.createElement('div');p.className='pair';const dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=label;dd.textContent=value||'—';p.append(dt,dd);$('summary').append(p);
  }
  function summary(){
    const d=data(),names={MFZ:'My Fly Zone',PIN:'Pineta Sacchetti',OUT:'Outdoor'};$('summary').replaceChildren();
    row('Data',d.data.split('-').reverse().join('/'));row('Sede',names[d.sede]);
    if(d.sede==='OUT')row('Località Outdoor',d.localitaOutdoor);row('Tipo',d.attivita);
    row('Orario',d.orario);row('Gruppo',d.gruppo);row('Attività',d.didattica);
  }
  function setStage(n){
    if(pending && n<2 && !ricompilazioneSospesa){
      registraErrore('Esiste un invio sospeso. Prima verifica la registrazione; poi, se necessario, ricompila mantenendo lo stesso ID.');return;
    }
    stage=n;for(let i=0;i<3;i++){
      $('stage-'+i).classList.toggle('hidden',i!==n);
      document.querySelector('[data-progress="'+i+'"]').className='step'+(i===n?' active':(i<n?' done':''));
    }
    if(n===1)$('lessonSummary1').textContent=lessonLabel();
    if(n===2){summary();aggiornaRegistrazione();}
    window.scrollTo({top:0,behavior:'instant'});
  }
  function copyText(){
    const d=data();return ['ONELEVEN MTB — '+(completata?'ATTIVITÀ REGISTRATA':'RIEPILOGO DA CONFERMARE'),'Data: '+d.data,
      'Sede: '+(d.sede==='MFZ'?'My Fly Zone':(d.sede==='PIN'?'Pineta Sacchetti':'Outdoor')),
      ...(d.sede==='OUT'?['Località Outdoor: '+d.localitaOutdoor]:[]),
      'Tipo: '+d.attivita,'Orario: '+d.orario,'Gruppo: '+d.gruppo,'ID gruppo: '+d.idGruppo,
      'Attività didattica:\n'+d.didattica].join('\n\n');
  }
  function copyFallback(t){const e=document.createElement('textarea');e.value=t;e.style.position='fixed';e.style.opacity='0';document.body.append(e);e.select();const ok=document.execCommand('copy');e.remove();if(!ok)throw new Error('Copia non riuscita');}
  function nuovoIdDidattica(){
    if(!globalThis.crypto || !crypto.getRandomValues)return '';
    const b=new Uint8Array(16);crypto.getRandomValues(b);
    const hex=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
    return 'D-'+hex;
  }
  function aggiornaRegistrazione(){
    const b=$('registraDidattica');
    if(completata){b.disabled=true;b.textContent='ATTIVITÀ REGISTRATA';return;}
    if(!REGISTRAZIONE_ABILITATA){b.disabled=true;b.textContent='REGISTRAZIONE DISPONIBILE SOLO SUL SITO';return;}
    b.disabled=!token||!gruppi.length||!!pending||inInvio;
    b.textContent='REGISTRA ATTIVITÀ';
  }
  function idSalvato(){
    if(!pending)return false;
    try { const raw=JSON.stringify(pending);
      localStorage.setItem(PENDING_KEY,raw);
      return localStorage.getItem(PENDING_KEY)===raw;
    }catch(_){return false;}
  }
  function confermata(){
    completata=true;
    ricompilazioneSospesa=false;
    try{localStorage.removeItem(PENDING_KEY);}catch(_){}
    const id=pending&&pending.idDidattica;
    pending=null;
    idCorrente=null;
    $('retryDidattica').hidden=true;
    $('checkDidattica').hidden=true;
    $('nuovaAttivita').hidden=false;
    registraErrore('REGISTRAZIONE CONFERMATA DA GOOGLE. ID '+(id||''));
    aggiornaRegistrazione();
  }
  function verificaPending(){
    if(!pending || inInvio || !token)return;
    inInvio=true;aggiornaRegistrazione();
    registraErrore('Controllo registrazione su Google in corso...');
    leggiJsonp({azione:'didatticaVerificaV3',idDidattica:pending.idDidattica},function(err,r){
      inInvio=false;
      if(!err&&r&&r.ok===true&&r.registrata===true&&r.idDidattica===pending.idDidattica){
        confermata();return;
      }
      const id=pending.idDidattica;
      registraErrore('Registrazione non confermata. ID '+id+'. NON creare un nuovo ID. '+
        (idCorrente?'Puoi verificare o riprovare con lo stesso ID.':
        'Se l’attività non risulta registrata, ricompila gli stessi dati mantenendo questo ID.'));
      $('checkDidattica').hidden=false;
      $('retryDidattica').hidden=false;
      $('retryDidattica').textContent=idCorrente?'RIPROVA STESSO ID':
        (ricompilazioneSospesa?'RIPROVA STESSO ID':'RICOMPILA INVIO SOSPESO');
      aggiornaRegistrazione();
    });
  }
  function preparaPayload(d){
    return {dataLezione:d.data,sede:d.sede,tipoAttivita:d.attivita,
      orarioLezione:d.orario,idGruppo:d.idGruppo,
      descrizioneOccasionale:d.descrizioneOccasionale,
      localitaOutdoor:d.localitaOutdoor,attivitaDidattica:d.didattica};
  }
  function inviaStessoId(){
    if(!pending||inInvio)return;
    if(!idCorrente && ricompilazioneSospesa){
      if(!validLesson()||!validText())return;
      idCorrente=preparaPayload(data());
    }
    if(!idCorrente)return;
    if(!REGISTRAZIONE_ABILITATA||!token||!gruppi.length)return;
    inInvio=true;aggiornaRegistrazione();
    $('retryDidattica').hidden=true;
    $('checkDidattica').hidden=true;
    registraErrore('Invio didattica in corso. Attendere la verifica prima di uscire.');
    const payload=Object.assign({},idCorrente,{azione:'didatticaRegistraV3',token:token,idDidattica:pending.idDidattica});
    fetch(API_URL,{method:'POST',mode:'no-cors',credentials:'omit',redirect:'follow',
      headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)})
    .then(()=>{inInvio=false;verificaPending();})
    .catch(()=>{inInvio=false;verificaPending();}); // Il POST potrebbe essere arrivato comunque.
  }
  function registra(){
    if(!REGISTRAZIONE_ABILITATA||!token||!gruppi.length||inInvio||completata||pending)return;
    if(!validLesson()||!validText())return;
    const d=data();
    const id=nuovoIdDidattica();
    if(!id){registraErrore('Impossibile generare un ID sicuro. Nessun invio effettuato.');return;}
    // Se un'altra scheda ha gia' creato un ID sospeso, blocchiamo il nuovo invio.
    try{if(localStorage.getItem(PENDING_KEY)){
      registraErrore('Esiste un invio sospeso su questo dispositivo. Riapri dal tuo scanner e verifica prima di riprovare.');return;
    }}catch(_){registraErrore('Impossibile verificare la memoria di sicurezza. Nessun invio effettuato.');return;}
    idCorrente=preparaPayload(d);
    pending={idDidattica:id};
    if(!idSalvato()){pending=null;idCorrente=null;
      registraErrore('Impossibile memorizzare l\u2019ID di sicurezza. Nessun invio effettuato.');return;}
    inviaStessoId();
  }
  populate();groups();caricaGruppiGoogle();
  aggiornaRegistrazione();
  if(pending){
    setStage(2);
    $('checkDidattica').hidden=false;
    registraErrore('Invio precedente da verificare (ID '+pending.idDidattica+'). Non creare una seconda nota.');
  }
  $('registraDidattica').addEventListener('click',registra);
  $('checkDidattica').addEventListener('click',verificaPending);
  $('retryDidattica').addEventListener('click',function(){
    if(!pending||inInvio||!token||!gruppi.length)return;
    if(!idCorrente && !ricompilazioneSospesa){
      // Il testo non e' mai stato conservato sul dispositivo: ricompilazione manuale.
      ricompilazioneSospesa=true;
      registraErrore('Ricompila i dati originali. Il prossimo invio userà lo STESSO ID sospeso: '+pending.idDidattica);
      setStage(0);
      $('stage0Error').textContent='INVIO SOSPESO: ricompila gli stessi dati, senza cambiare ID. Quando arrivi al riepilogo premi RIPROVA STESSO ID.';
      $('retryDidattica').textContent='RIPROVA STESSO ID';
      return;
    }
    inviaStessoId();
  });
  $('nuovaAttivita').addEventListener('click',function(){
    if(!completata||pending||inInvio)return;
    completata=false;ricompilazioneSospesa=false;idCorrente=null;
    $('lessonDate').value=dateToday();$('sede').value='';$('attivita').value='';$('ora').value='';
    $('localitaOutdoor').value='';$('descrizioneOccasionale').value='';$('didattica').value='';
    $('didatticaCounter').textContent='0';$('stage0Error').textContent='';$('stage1Error').textContent='';
    $('copyResult').textContent='';registraErrore('');groups();
    $('nuovaAttivita').hidden=true;
    setStage(0);
    aggiornaRegistrazione();
  });

  // Ritorno intenzionale allo scanner. Non salva dati né genera nuove registrazioni.
  $('tornaScanner').addEventListener('click',function(){
    const cambiamenti=!!$('sede').value||!!$('attivita').value||!!$('ora').value||
      !!$('gruppo').value||!!$('localitaOutdoor').value.trim()||
      !!$('descrizioneOccasionale').value.trim()||!!$('didattica').value.trim();
    if(inInvio){alert('Invio in corso: attendi la risposta prima di uscire.');return;}
    if(pending){
      if(!confirm('Un invio didattico è ancora da verificare. Uscendo, dovrai verificarlo prima di registrare un’altra attività. Tornare allo scanner?'))return;
    }else if(!completata&&cambiamenti){
      if(!confirm('La compilazione didattica non è stata salvata. Vuoi uscire e perdere i dati inseriti?'))return;
    }
    location.assign('../index.html'+(token?'?token='+encodeURIComponent(token):''));
  });

  $('sede').addEventListener('change',groups);
  $('gruppo').addEventListener('change',occasionale);
  $('didattica').addEventListener('input',()=>$('didatticaCounter').textContent=String($('didattica').value.length));
  $('go1').addEventListener('click',()=>{if(validLesson())setStage(1);});
  $('go2').addEventListener('click',()=>{if(validText())setStage(2);});
  $('back0').addEventListener('click',()=>setStage(0));
  $('back1').addEventListener('click',()=>setStage(1));
  $('copy').addEventListener('click',function(){
    const s=copyText();Promise.resolve().then(()=>navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(s):copyFallback(s))
      .then(()=>$('copyResult').textContent='Riepilogo copiato negli appunti.')
      .catch(()=>$('copyResult').textContent='Impossibile copiare. Per gli appunti usa HTTPS.');
  });
})();
