/* ONELEVEN MTB - DIDATTICA V3.1 - ANTEPRIMA SOLO LETTURA.
   Il maestro viene autorizzato da Google prima della lettura dei gruppi.
   Nessun invio POST e nessun salvataggio didattico abilitato.
   "Varie ed eventuali" continua a essere gestito nello scanner principale. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const tipi=['CLUB','IND','COLL >2','COLL <2','PROVA','DAILY','OUT >2','OUT <2'];
  // Indirizzo pubblico dell'API, non contiene password o token personali.
  const API_URL='https://script.google.com/macros/s/AKfycbypRKLkU0RPV8I9WrHV6N24bDnecyAdB0p1hZT4VrGNKDBH0bVspKZg750s_HwNjxs/exec';
  const hashParams=new URLSearchParams(location.hash.replace(/^#/,''));
  const token=hashParams.get('token')||'';
  // Rimuove il token dalla barra indirizzi appena letto; rimane solo in memoria.
  if(token){
    try { history.replaceState(null,'',location.pathname+location.search); }catch(_){ /* file:// */ }
  }
  const avviso=document.querySelector('.notice[role="status"]');
  // Il catalogo incorporato serve SOLO a continuare le prove offline senza token.
  // Nell'accesso autenticato il catalogo deve arrivare da ANAGRAFICA GRUPPI.
  let gruppi=token?[]:(window.ONELEVEN_GRUPPI||[]);
  let stage=0;

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
    avviso.textContent='Verifica dell’accesso del maestro e lettura gruppi da Google in corso. Salvataggio ancora disabilitato.';
    leggiJsonp({azione:'didatticaElencoGruppiV3'},function(errore,risposta){
      if(errore||!risposta||risposta.ok!==true||!Array.isArray(risposta.gruppi)){
        avviso.textContent='Accesso o lettura gruppi non disponibile. Non è possibile usare i gruppi online. Nessun dato è stato inviato.';
        return;
      }
      const ids=new Set(),valide=[];
      for(const r of risposta.gruppi){
        if(!r||typeof r.id!=='string'||typeof r.nome!=='string'||
           !/^(MFZ|PIN|OUT)-[A-Z0-9-]{1,70}$/.test(r.id)||
           !['MFZ','PIN','OUT'].includes(r.sede)||!r.id.startsWith(r.sede+'-')||
           !r.nome.trim()||ids.has(r.id)){
          avviso.textContent='Anagrafica gruppi inattesa. Nessuna operazione consentita.';
          return;
        }
        ids.add(r.id);
        valide.push({id:r.id,sede:r.sede,categoria:String(r.categoria||''),nome:r.nome,attivo:true});
      }
      if(valide.length===0||valide.length>100){
        avviso.textContent='Anagrafica gruppi vuota o inattesa. Nessuna operazione consentita.';
        return;
      }
      gruppi=valide;
      groups();
      avviso.textContent='Accesso verificato: '+valide.length+' gruppi attivi letti da Google. Salvataggio ancora disabilitato.';
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
    stage=n;for(let i=0;i<3;i++){
      $('stage-'+i).classList.toggle('hidden',i!==n);
      document.querySelector('[data-progress="'+i+'"]').className='step'+(i===n?' active':(i<n?' done':''));
    }
    if(n===1)$('lessonSummary1').textContent=lessonLabel();
    if(n===2)summary();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function copyText(){
    const d=data();return ['ONELEVEN MTB — ANTEPRIMA NON REGISTRATA','Data: '+d.data,
      'Sede: '+(d.sede==='MFZ'?'My Fly Zone':(d.sede==='PIN'?'Pineta Sacchetti':'Outdoor')),
      ...(d.sede==='OUT'?['Località Outdoor: '+d.localitaOutdoor]:[]),
      'Tipo: '+d.attivita,'Orario: '+d.orario,'Gruppo: '+d.gruppo,'ID gruppo: '+d.idGruppo,
      'Attività didattica:\n'+d.didattica].join('\n\n');
  }
  function copyFallback(t){const e=document.createElement('textarea');e.value=t;e.style.position='fixed';e.style.opacity='0';document.body.append(e);e.select();const ok=document.execCommand('copy');e.remove();if(!ok)throw new Error('Copia non riuscita');}
  populate();groups();caricaGruppiGoogle();
  $('sede').addEventListener('change',groups);
  $('gruppo').addEventListener('change',occasionale);
  $('didattica').addEventListener('input',()=>$('didatticaCounter').textContent=String($('didattica').value.length));
  $('go1').addEventListener('click',()=>{if(validLesson())setStage(1);});
  $('go2').addEventListener('click',()=>{if(validText())setStage(2);});
  $('back0').addEventListener('click',()=>setStage(0));
  $('back1').addEventListener('click',()=>setStage(1));
  $('copy').addEventListener('click',function(){
    const s=copyText();Promise.resolve().then(()=>navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(s):copyFallback(s))
      .then(()=>$('copyResult').textContent='Riepilogo copiato: nessuna registrazione effettuata.')
      .catch(()=>$('copyResult').textContent='Impossibile copiare. Per gli appunti usa HTTPS.');
  });
})();
