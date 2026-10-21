/* ONELEVEN MTB - DIDATTICA V3.7 - CLUB e PL V3.6 invariati + valutazione RIDER senza lezione.
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

  const tipi=['CLUB','PL','RIDER'];
  const livelli=['Principiante','Intermedio','Avanzato','RaceTeam'];
  let riders=[],ridersCaricati=false,ridersInCaricamento=false,rider=null;
  let livelloCaricato=false,ultimoLivello='',riderRichiesta=0;
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
  if(intro)intro.textContent='Scegli CLUB o PL per la lezione. Con RIDER registri solo data, allievo, livello e commento: nessuna lezione.';
  if(riepilogo)riepilogo.textContent='Controlla tutti i dati: la registrazione sara’ effettiva solo dopo la conferma da Google.';
  if(avvisoRiepilogo)avvisoRiepilogo.textContent=REGISTRAZIONE_ABILITATA
    ?'La registrazione sarà salvata nel registro didattico corrispondente. In caso di interruzione verifica l’ID sospeso prima di riprovare.'
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
      ?'Verifica accesso e gruppi in corso.'
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
  function normalizza(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();}
  function livelloScelto(){return document.querySelector('input[name="livelloTecnico"]:checked')?.value||'';}
  function impostaLivello(valore){
    document.querySelectorAll('input[name="livelloTecnico"]').forEach(r=>r.checked=r.value===valore);
  }
  function cancellaRider(){
    rider=null;livelloCaricato=false;ultimoLivello='';riderRichiesta++;
    impostaLivello('');$('riderSelezionato').textContent='Nessun allievo selezionato.';
    $('livelloState').textContent='Seleziona prima un allievo.';
  }
  function ricercaRider(){
    const box=$('riderRisultati');box.replaceChildren();
    const q=normalizza($('cercaRider').value);
    if(!ridersCaricati){if(q)box.textContent='Anagrafica in caricamento.';return;}
    if(q.length<2){if(q)box.textContent='Scrivi almeno due caratteri del cognome.';return;}
    const trovati=riders.filter(a=>normalizza(a.cognome).startsWith(q)).slice(0,12);
    if(!trovati.length){box.textContent='Nessun allievo trovato.';return;}
    trovati.forEach(a=>{
      const b=document.createElement('button');b.type='button';b.className='rider-result';
      b.textContent=a.cognome+' '+a.nome;
      b.addEventListener('click',()=>selezionaRider(a));box.appendChild(b);
    });
  }
  function selezionaRider(a){
    cancellaRider();rider=a;
    $('cercaRider').value=a.cognome+' '+a.nome;
    $('riderRisultati').replaceChildren();
    $('riderSelezionato').textContent='Selezionato: '+a.nome+' '+a.cognome;
    $('livelloState').textContent='Lettura dell’ultimo livello tecnico...';
    const richiesta=++riderRichiesta;
    leggiJsonp({azione:'didatticaPLLivelloV36',idOneleven:a.id},(err,r)=>{
      if(richiesta!==riderRichiesta || !rider || rider.id!==a.id)return;
      if(err||!r||r.ok!==true||r.idOneleven!==a.id||
        (r.livelloTecnico&&!livelli.includes(r.livelloTecnico))){
        livelloCaricato=false;
        $('livelloState').textContent='Livello non disponibile. Reseleziona l’allievo per riprovare.';
        return;
      }
      ultimoLivello=r.livelloTecnico||'';
      impostaLivello(ultimoLivello);livelloCaricato=true;
      $('livelloState').textContent=ultimoLivello
        ?'Livello precedente: '+ultimoLivello+' (puoi modificarlo).'
        :'Prima valutazione individuale: scegli un livello tecnico.';
    });
  }
  function caricaRidersGoogle(){
    if(!token||ridersCaricati||ridersInCaricamento)return;
    ridersInCaricamento=true;
    $('riderSelezionato').textContent='Caricamento degli iscritti...';
    leggiJsonp({azione:'scannerElenco'},(err,r)=>{
      ridersInCaricamento=false;
      if(err||!r||r.ok!==true||!Array.isArray(r.allievi)){
        $('riderSelezionato').textContent='Elenco allievi non disponibile. Riprova a selezionare PL o RIDER.';
        return;
      }
      const visti=new Set(),elenco=[];
      for(const a of r.allievi){
        if(!a||typeof a.id!=='string'||typeof a.nome!=='string'||
          typeof a.cognome!=='string'||!a.id.trim()||!a.nome.trim()||!a.cognome.trim())continue;
        const key=a.id.toUpperCase();
        if(visti.has(key))continue;
        visti.add(key);elenco.push({id:a.id.trim(),nome:a.nome.trim(),cognome:a.cognome.trim()});
      }
      if(!elenco.length){$('riderSelezionato').textContent='Nessun allievo valido in anagrafica.';return;}
      riders=elenco.sort((a,b)=>(a.cognome+' '+a.nome).localeCompare(b.cognome+' '+b.nome,'it'));
      ridersCaricati=true;
      $('riderSelezionato').textContent='Cerca l’allievo digitando il cognome.';
      ricercaRider();
    });
  }
  function cambiaTipo(){
    const tipo=$('attivita').value;
    const club=tipo==='CLUB',pl=tipo==='PL',soloRider=tipo==='RIDER';
    $('clubBox').classList.toggle('hidden',!club);
    $('plBox').classList.toggle('hidden',!(pl||soloRider));
    $('pacchettoBox').classList.toggle('hidden',!pl);
    $('friendsHint').classList.toggle('hidden',!pl);
    $('sedeOraBox').classList.toggle('hidden',soloRider);
    $('dataLabel').innerHTML=soloRider?'Data della valutazione <em>*</em>':'Data della lezione <em>*</em>';
    if(pl||soloRider)caricaRidersGoogle();
    $('stage0Error').textContent='';
  }
  function data(){
    const attivita=$('attivita').value;
    const id=attivita==='CLUB'?$('gruppo').value:'',g=gruppi.find(x=>x.id===id);
    const desc=$('descrizioneOccasionale').value.trim();
    const senzaLezione=attivita==='RIDER',individuale=['PL','RIDER'].includes(attivita);
    return {data:$('lessonDate').value,
      sede:senzaLezione?'':$('sede').value,
      localitaOutdoor:!senzaLezione&&$('sede').value==='OUT'?$('localitaOutdoor').value.trim():'',
      attivita:attivita,orario:senzaLezione?'':$('ora').value,
      idGruppo:id,gruppo:id==='OCCASIONALE'?'Gruppo occasionale: '+desc:(g?g.nome:''),
      descrizioneOccasionale:id==='OCCASIONALE'?desc:'',
      pacchetto:attivita==='PL'?$('pacchetto').value:'',
      idOneleven:individuale&&rider?rider.id:'',
      nomeRider:individuale&&rider?rider.nome+' '+rider.cognome:'',
      livello:individuale?livelloScelto():'',
      didattica:$('didattica').value.replace(/\r\n?/g,'\n').trim()};
  }
  function validLesson(){
    const d=data();let msg='';
    if(!validDate(d.data))msg='Seleziona una data valida.';
    else if(!tipi.includes(d.attivita))msg='Seleziona il tipo di attività.';
    else if(d.attivita!=='RIDER'&&!['MFZ','PIN','OUT'].includes(d.sede))msg='Seleziona una sede.';
    else if(d.attivita!=='RIDER'&&d.sede==='OUT'&&(!d.localitaOutdoor||d.localitaOutdoor.length>140))msg='Indica la località della lezione Outdoor (massimo 140 caratteri).';
    else if(d.attivita!=='RIDER'&&!Array.from($('ora').options).some(o=>o.value===d.orario&&!!o.value))msg='Seleziona un orario.';
    else if(d.attivita==='CLUB'&&token&&!gruppi.length)msg='Attendi il caricamento dei gruppi.';
    else if(d.attivita==='CLUB'&&d.idGruppo==='OCCASIONALE'&&(!d.descrizioneOccasionale||d.descrizioneOccasionale.length>120))msg='Descrivi il gruppo occasionale (massimo 120 caratteri).';
    else if(d.attivita==='CLUB'&&d.idGruppo!=='OCCASIONALE'&&!gruppi.some(g=>g.id===d.idGruppo&&g.sede===d.sede&&g.attivo))msg='Scegli un gruppo valido per la sede.';
    else if(d.attivita==='PL'&&!['IND','FRIENDS'].includes(d.pacchetto))msg='Seleziona IND o FRIENDS.';
    else if(['PL','RIDER'].includes(d.attivita)&&!ridersCaricati)msg='Attendi la ricerca degli allievi da Google.';
    else if(['PL','RIDER'].includes(d.attivita)&&!d.idOneleven)msg='Cerca e seleziona un allievo per cognome.';
    else if(['PL','RIDER'].includes(d.attivita)&&!livelloCaricato)msg='Attendi il caricamento del livello tecnico del rider.';
    $('stage0Error').textContent=msg;return !msg;
  }
  function validText(){
    const t=data().didattica;
    const levelOk=!['PL','RIDER'].includes(data().attivita)||(livelloCaricato&&livelli.includes(livelloScelto()));
    $('stage1Error').textContent=!levelOk?'Seleziona il livello tecnico dell’allievo.':
      (!t||t.length>2000)?'Inserisci l’attività didattica (1-2000 caratteri).':'';
    return !!t&&t.length<=2000&&levelOk;
  }
  function lessonLabel(){
    const d=data();
    if(d.attivita==='RIDER')return [d.data,'RIDER',d.nomeRider].filter(Boolean).join(' · ');
    return [d.data,d.sede==='MFZ'?'My Fly Zone':(d.sede==='PIN'?'Pineta Sacchetti':'Outdoor'),d.attivita,d.orario,
      d.attivita==='PL'?(d.pacchetto+' · '+d.nomeRider):d.gruppo].filter(Boolean).join(' · ');
  }
  function row(label,value){
    const p=document.createElement('div');p.className='pair';const dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=label;dd.textContent=value||'—';p.append(dt,dd);$('summary').append(p);
  }
  function summary(){
    const d=data(),names={MFZ:'My Fly Zone',PIN:'Pineta Sacchetti',OUT:'Outdoor'};$('summary').replaceChildren();
    row(d.attivita==='RIDER'?'Data valutazione':'Data',d.data.split('-').reverse().join('/'));
    if(d.attivita!=='RIDER')row('Sede',names[d.sede]);
    if(d.sede==='OUT')row('Località Outdoor',d.localitaOutdoor);
    row('Tipo',d.attivita);
    if(d.attivita!=='RIDER')row('Orario',d.orario);
    if(d.attivita==='CLUB')row('Gruppo',d.gruppo);
    if(d.attivita==='PL')row('Pacchetto',d.pacchetto);
    if(['PL','RIDER'].includes(d.attivita)){row('Allievo',d.nomeRider);row('Livello',d.livello);}
    row(d.attivita==='RIDER'?'Commento / Skill':(d.attivita==='PL'?'Valutazione':'Attività'),d.didattica);
  }
  function setStage(n){
    if(pending && n<2 && !ricompilazioneSospesa){
      registraErrore('Esiste un invio sospeso. Prima verifica la registrazione; poi, se necessario, ricompila mantenendo lo stesso ID.');return;
    }
    stage=n;for(let i=0;i<3;i++){
      $('stage-'+i).classList.toggle('hidden',i!==n);
      document.querySelector('[data-progress="'+i+'"]').className='step'+(i===n?' active':(i<n?' done':''));
    }
    if(n===1){
      $('lessonSummary1').textContent=lessonLabel();
      const tipo=data().attivita;
      $('livelloBox').classList.toggle('hidden',!['PL','RIDER'].includes(tipo));
      $('didatticaLabel').textContent=tipo==='RIDER'?'Commento / Skill *':
        (tipo==='PL'?'Valutazione della lezione *':'Lavoro svolto e obiettivi *');
    }
    if(n===2){
      summary();aggiornaRegistrazione();
      $('copyDescription').hidden=data().attivita!=='PL';
    }
    window.scrollTo({top:0,behavior:'instant'});
  }
  function copyText(){
    const d=data();return ['ONELEVEN MTB — '+(completata?'ATTIVITÀ REGISTRATA':'RIEPILOGO DA CONFERMARE'),
      'Data: '+d.data,
      ...(d.attivita==='RIDER'?[]:['Sede: '+(d.sede==='MFZ'?'My Fly Zone':(d.sede==='PIN'?'Pineta Sacchetti':'Outdoor'))]),
      ...(d.sede==='OUT'?['Località Outdoor: '+d.localitaOutdoor]:[]),
      'Tipo: '+d.attivita,
      ...(d.attivita==='RIDER'?[]:['Orario: '+d.orario]),
      ...(d.attivita==='CLUB'?['Gruppo: '+d.gruppo]:
        (d.attivita==='PL'?['Pacchetto: '+d.pacchetto,'Allievo: '+d.nomeRider,'Livello: '+d.livello]:
        ['Allievo: '+d.nomeRider,'Livello: '+d.livello])),
      (d.attivita==='RIDER'?'Commento / Skill:\n':'Attività didattica:\n')+d.didattica].join('\n\n');
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
    const d=data();
    const datiPronti=['PL','RIDER'].includes(d.attivita)?(ridersCaricati&&!!rider&&livelloCaricato):
      d.attivita==='CLUB'&&gruppi.length>0;
    b.disabled=!token||!datiPronti||!!pending||inInvio;
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
    leggiJsonp({azione:pending.tipo==='CLUB'?'didatticaVerificaV3':'didatticaPLVerificaV36',
      idDidattica:pending.idDidattica},function(err,r){
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
    // RIDER non deve nemmeno INVIARE campi sede/orario/pacchetto.
    if(d.attivita==='RIDER')return {tipoAttivita:'RIDER',dataLezione:d.data,
      idOneleven:d.idOneleven,livelloTecnico:d.livello,attivitaDidattica:d.didattica};
    const base={dataLezione:d.data,sede:d.sede,orarioLezione:d.orario,
      localitaOutdoor:d.localitaOutdoor,attivitaDidattica:d.didattica};
    return d.attivita==='PL'?Object.assign(base,{tipoPacchetto:d.pacchetto,
      idOneleven:d.idOneleven,livelloTecnico:d.livello}):
      Object.assign(base,{tipoAttivita:'CLUB',idGruppo:d.idGruppo,
        descrizioneOccasionale:d.descrizioneOccasionale});
  }
  function inviaStessoId(){
    if(!pending||inInvio)return;
    if(!idCorrente && ricompilazioneSospesa){
      if(!validLesson()||!validText())return;
      idCorrente=preparaPayload(data());
    }
    if(!idCorrente)return;
    if(!REGISTRAZIONE_ABILITATA||!token)return;
    if(['PL','RIDER'].includes(pending.tipo)&&(!ridersCaricati||!rider||!livelloCaricato))return;
    if(pending.tipo==='CLUB'&&!gruppi.length)return;
    if((pending.tipo==='CLUB')!==!idCorrente.idOneleven ||
      (pending.tipo==='RIDER')!==(idCorrente.tipoAttivita==='RIDER') ||
      (pending.tipo==='PL')!==!!idCorrente.tipoPacchetto){
      registraErrore('Il tipo di invio non corrisponde all’ID sospeso. Nessun dato inviato.');return;
    }
    inInvio=true;aggiornaRegistrazione();
    $('retryDidattica').hidden=true;
    $('checkDidattica').hidden=true;
    registraErrore('Invio didattica in corso. Attendere la verifica prima di uscire.');
    const azione=pending.tipo==='PL'?'didatticaPLRegistraV36':
      (pending.tipo==='RIDER'?'didatticaRiderRegistraV37':'didatticaRegistraV3');
    const payload=Object.assign({},idCorrente,{azione:azione,
      token:token,idDidattica:pending.idDidattica});
    fetch(API_URL,{method:'POST',mode:'no-cors',credentials:'omit',redirect:'follow',
      headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload)})
    .then(()=>{inInvio=false;verificaPending();})
    .catch(()=>{inInvio=false;verificaPending();}); // Il POST potrebbe essere arrivato comunque.
  }
  function registra(){
    if(!REGISTRAZIONE_ABILITATA||!token||inInvio||completata||pending)return;
    if(!validLesson()||!validText())return;
    const d=data();
    const id=nuovoIdDidattica();
    if(!id){registraErrore('Impossibile generare un ID sicuro. Nessun invio effettuato.');return;}
    // Se un'altra scheda ha gia' creato un ID sospeso, blocchiamo il nuovo invio.
    try{if(localStorage.getItem(PENDING_KEY)){
      registraErrore('Esiste un invio sospeso su questo dispositivo. Riapri dal tuo scanner e verifica prima di riprovare.');return;
    }}catch(_){registraErrore('Impossibile verificare la memoria di sicurezza. Nessun invio effettuato.');return;}
    idCorrente=preparaPayload(d);
    pending={idDidattica:id,tipo:d.attivita};
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
    if(!pending||inInvio||!token)return;
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
    $('pacchetto').value='';$('cercaRider').value='';$('riderRisultati').replaceChildren();cancellaRider();
    $('didatticaCounter').textContent='0';$('stage0Error').textContent='';$('stage1Error').textContent='';
    $('copyResult').textContent='';registraErrore('');groups();cambiaTipo();
    $('nuovaAttivita').hidden=true;
    setStage(0);
    aggiornaRegistrazione();
  });

  // Ritorno intenzionale allo scanner. Non salva dati né genera nuove registrazioni.
  $('tornaScanner').addEventListener('click',function(){
    const cambiamenti=!!$('sede').value||!!$('attivita').value||!!$('ora').value||
      !!$('gruppo').value||!!$('pacchetto').value||!!rider||!!$('localitaOutdoor').value.trim()||
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
  $('attivita').addEventListener('change',cambiaTipo);
  $('cercaRider').addEventListener('input',()=>{cancellaRider();ricercaRider();});
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
  $('copyDescription').addEventListener('click',function(){
    const s=data().didattica;
    if(!s){$('copyResult').textContent='Nessuna descrizione da copiare.';return;}
    Promise.resolve().then(()=>navigator.clipboard&&navigator.clipboard.writeText?
      navigator.clipboard.writeText(s):copyFallback(s))
      .then(()=>$('copyResult').textContent='Solo la descrizione è stata copiata.')
      .catch(()=>$('copyResult').textContent='Impossibile copiare la descrizione.');
  });
})();
