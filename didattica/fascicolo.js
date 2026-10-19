/* ONELEVEN - Fascicolo Maestri V3.2. Sola lettura, nessun salvataggio e nessuna cache locale. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const API_URL='https://script.google.com/macros/s/AKfycby3R-1Nls1V3JCD-FMQWw6Su10NM_cuqB4_uIPjJ3-WMwspP5XiEaaXnP79F2Qt8OXz/exec';
  const token=new URLSearchParams(location.hash.replace(/^#/,'')).get('token')||'';
  if(token){
    try{history.replaceState(null,'',location.pathname+location.search);}catch(_){}
    $('ritorno').href='index.html#token='+encodeURIComponent(token);
  }
  $('tornaScanner').addEventListener('click',function(){
    location.assign('../index.html'+(token?'?token='+encodeURIComponent(token):''));
  });
  let gruppi=[],nomeMaestro='';let serial=0,caricamento=false;
  function get(params,cb){
    const nome='onelevenFascicolo'+Date.now()+'_'+(++serial);
    const script=document.createElement('script');let chiuso=false;
    const timer=setTimeout(()=>finisci(new Error('Timeout di connessione')),20000);
    function finisci(err,val){if(chiuso)return;chiuso=true;clearTimeout(timer);script.remove();
      try{delete window[nome];}catch(_){window[nome]=undefined;} cb(err,val);}
    window[nome]=val=>finisci(null,val);
    script.onerror=()=>finisci(new Error('Collegamento non riuscito'));
    const qs=new URLSearchParams(Object.assign({},params,{token,callback:nome}));
    script.src=API_URL+'?'+qs.toString();document.body.appendChild(script);
  }
  function opzione(sel,v,t){const o=document.createElement('option');o.value=v;o.textContent=t;sel.appendChild(o);}
  function riempiGruppi(){
    const sel=$('gruppoFiltro'),sede=$('sedeFiltro').value;
    sel.replaceChildren();opzione(sel,'','Tutti');
    gruppi.filter(x=>!sede||x.sede===sede).forEach(g=>opzione(sel,g.id,g.nome+' ('+g.sede+')'));
    opzione(sel,'OCCASIONALE','Gruppo occasionale');
  }
  function testo(tag,classe,contenuto){const el=document.createElement(tag);
    if(classe)el.className=classe;el.textContent=contenuto||'';return el;}
  function mostra(note){
    const box=$('risultati');box.replaceChildren();
    if(!note.length){box.appendChild(testo('p','hint','Nessuna attività registrata per i filtri selezionati.'));return;}
    note.forEach(r=>{
      const div=testo('article','voce','');
      div.appendChild(testo('h2','',r.dataLezione+' · '+r.orarioLezione+' · '+r.sede));
      div.appendChild(testo('p','meta',r.tipoAttivita+' · '+r.nomeGruppo+' · '+r.maestro));
      if(r.localitaOutdoor)div.appendChild(testo('p','meta','Località: '+r.localitaOutdoor));
      if(r.descrizioneOccasionale)div.appendChild(testo('p','meta','Occasionale: '+r.descrizioneOccasionale));
      div.appendChild(testo('p','',r.attivitaDidattica));
      box.appendChild(div);
    });
  }
  function carica(){
    if(caricamento||!token||!gruppi.length)return;
    if($('da').value && $('a').value && $('da').value>$('a').value){$('esito').textContent='Intervallo di date non valido.';return;}
    caricamento=true;$('cerca').disabled=true;$('esito').textContent='Consultazione in corso...';
    const filtri={azione:'didatticaFascicoloV3',dataDa:$('da').value,dataA:$('a').value,
      sede:$('sedeFiltro').value,idGruppo:$('gruppoFiltro').value,maestro:$('maestroFiltro').value.trim()};
    get(filtri,(err,r)=>{
      caricamento=false;$('cerca').disabled=false;
      if(err||!r||r.ok!==true||!Array.isArray(r.note)){
        $('esito').textContent='Fascicolo non disponibile o accesso non autorizzato.';return;}
      $('esito').textContent=r.note.length+' attività trovate (massimo 100 per ricerca).';
      mostra(r.note);
    });
  }
  $('sedeFiltro').addEventListener('change',riempiGruppi);
  $('cerca').addEventListener('click',carica);
  if(!token){$('stato').textContent='Accesso maestro mancante. Apri il Fascicolo dallo scanner autorizzato.';return;}
  get({azione:'didatticaElencoGruppiV3'},(err,r)=>{
    if(err||!r||r.ok!==true||!Array.isArray(r.gruppi)||r.gruppi.length<1){
      $('stato').textContent='Impossibile verificare accesso o gruppi. Fascicolo non disponibile.';return;}
    gruppi=r.gruppi.filter(g=>g&&typeof g.id==='string'&&typeof g.nome==='string'&&['MFZ','PIN','OUT'].includes(g.sede));
    if(!gruppi.length){$('stato').textContent='Anagrafica gruppi non valida.';return;}
    riempiGruppi();$('cerca').disabled=false;$('stato').hidden=true;
  });
})();
