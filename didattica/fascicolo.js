/* ONELEVEN - Fascicolo Maestri V3.7. Gruppi Club, valutazioni PL e RIDER.
   Sola lettura, nessuna cache persistente e nessuna modifica a Excel. */
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
  let riders=[],ridersCaricati=false,ridersCaricamento=false,riderSelezionato=null,caricamentoPL=false;
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
  function normalizza(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();}
  function azzeraRider(){
    riderSelezionato=null;
    $('riderSelezionatoFascicolo').textContent='Nessun allievo selezionato.';
    $('cercaScheda').disabled=true;
    $('risultatiRider').replaceChildren();$('esitoRider').textContent='';
  }
  function filtraRider(){
    const box=$('riderRisultatiFascicolo');box.replaceChildren();
    const q=normalizza($('cercaRiderFascicolo').value);
    if(!ridersCaricati){if(q)box.textContent='Anagrafica in caricamento.';return;}
    if(q.length<2){if(q)box.textContent='Scrivi almeno due caratteri del cognome.';return;}
    const risultati=riders.filter(a=>normalizza(a.cognome).startsWith(q)).slice(0,12);
    if(!risultati.length){box.textContent='Nessun allievo trovato.';return;}
    risultati.forEach(a=>{
      const b=document.createElement('button');b.type='button';b.className='rider-result';
      b.textContent=a.cognome+' '+a.nome;
      b.addEventListener('click',()=>{
        riderSelezionato=a;
        $('cercaRiderFascicolo').value=a.cognome+' '+a.nome;
        box.replaceChildren();
        $('riderSelezionatoFascicolo').textContent='Selezionato: '+a.nome+' '+a.cognome;
        $('cercaScheda').disabled=false;
        $('risultatiRider').replaceChildren();$('esitoRider').textContent='';
      });
      box.appendChild(b);
    });
  }
  function caricaRiders(){
    if(!token||ridersCaricati||ridersCaricamento)return;
    ridersCaricamento=true;
    $('riderSelezionatoFascicolo').textContent='Caricamento iscritti da Google...';
    get({azione:'scannerElenco'},(err,r)=>{
      ridersCaricamento=false;
      if(err||!r||r.ok!==true||!Array.isArray(r.allievi)){
        $('riderSelezionatoFascicolo').textContent='Elenco allievi non disponibile. Riapri questa sezione per riprovare.';return;
      }
      const ids=new Set(),validi=[];
      for(const a of r.allievi){
        if(!a||typeof a.id!=='string'||typeof a.nome!=='string'||
           typeof a.cognome!=='string'||!a.id.trim()||!a.nome.trim()||!a.cognome.trim())continue;
        const id=a.id.toUpperCase();if(ids.has(id))continue;ids.add(id);
        validi.push({id:a.id.trim(),nome:a.nome.trim(),cognome:a.cognome.trim()});
      }
      if(!validi.length){$('riderSelezionatoFascicolo').textContent='Anagrafica vuota.';return;}
      riders=validi.sort((a,b)=>(a.cognome+' '+a.nome).localeCompare(b.cognome+' '+b.nome,'it'));
      ridersCaricati=true;
      $('riderSelezionatoFascicolo').textContent='Cerca l’allievo per cognome.';filtraRider();
    });
  }
  function mostraScheda(r){
    const box=$('risultatiRider');box.replaceChildren();
    box.appendChild(testo('h2','',r.nome+' '+r.cognome));
    box.appendChild(testo('p','meta','Livello tecnico attuale: '+(r.livelloTecnico||'Non ancora assegnato')));
    if(!r.note.length){
      box.appendChild(testo('p','hint','Nessuna valutazione individuale registrata per questo allievo nei giorni selezionati.'));
      return;
    }
    r.note.forEach(n=>{
      const articolo=testo('article','voce','');
      const autonomo=n.tipoPacchetto==='RIDER';
      articolo.appendChild(testo('h2','',autonomo?
        n.dataLezione+' · Valutazione RIDER':
        n.dataLezione+' · '+n.orarioLezione+' · '+n.sede));
      articolo.appendChild(testo('p','meta',autonomo?
        'RIDER · '+n.livelloTecnico+' · '+n.maestro:
        n.tipoPacchetto+' · '+n.livelloTecnico+' · '+n.maestro));
      if(n.localitaOutdoor)articolo.appendChild(testo('p','meta','Località: '+n.localitaOutdoor));
      articolo.appendChild(testo('p','',n.valutazione));box.appendChild(articolo);
    });
  }
  function caricaScheda(){
    if(caricamentoPL||!token||!riderSelezionato)return;
    const idRichiesto=riderSelezionato.id;
    const da=$('daPL').value,a=$('aPL').value;
    if(da&&a&&da>a){$('esitoRider').textContent='Intervallo di date non valido.';return;}
    caricamentoPL=true;$('cercaScheda').disabled=true;
    $('esitoRider').textContent='Lettura fascicolo in corso...';
    get({azione:'didatticaPLFascicoloV36',idOneleven:idRichiesto,dataDa:da,dataA:a},(err,r)=>{
      caricamentoPL=false;
      $('cercaScheda').disabled=!riderSelezionato;
      if(!riderSelezionato||riderSelezionato.id!==idRichiesto)return;
      if(err||!r||r.ok!==true||!Array.isArray(r.note)){
        $('esitoRider').textContent='Fascicolo PL non disponibile o accesso non autorizzato.';return;
      }
      $('esitoRider').textContent=r.note.length+' valutazioni individuali trovate (massimo 100).';
      mostraScheda(r);
    });
  }
  function cambiaVista(pl){
    $('gruppiSection').classList.toggle('hidden',pl);
    $('riderSection').classList.toggle('hidden',!pl);
    $('vistaGruppi').setAttribute('aria-pressed',String(!pl));
    $('vistaRider').setAttribute('aria-pressed',String(pl));
    if(pl)caricaRiders();
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
  $('vistaGruppi').addEventListener('click',()=>cambiaVista(false));
  $('vistaRider').addEventListener('click',()=>cambiaVista(true));
  $('cercaRiderFascicolo').addEventListener('input',()=>{azzeraRider();filtraRider();});
  $('cercaScheda').addEventListener('click',caricaScheda);
  if(!token){$('stato').textContent='Accesso maestro mancante. Apri il Fascicolo dallo scanner autorizzato.';return;}
  get({azione:'didatticaElencoGruppiV3'},(err,r)=>{
    if(err||!r||r.ok!==true||!Array.isArray(r.gruppi)||r.gruppi.length<1){
      $('stato').textContent='Impossibile verificare accesso o gruppi. Fascicolo non disponibile.';return;}
    gruppi=r.gruppi.filter(g=>g&&typeof g.id==='string'&&typeof g.nome==='string'&&['MFZ','PIN','OUT'].includes(g.sede));
    if(!gruppi.length){$('stato').textContent='Anagrafica gruppi non valida.';return;}
    riempiGruppi();$('cerca').disabled=false;$('stato').hidden=true;
  });
})();
