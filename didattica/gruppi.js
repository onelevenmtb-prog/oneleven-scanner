/* Catalogo iniziale di prova. In produzione andrà letto dal foglio ANAGRAFICA GRUPPI Google.
   Gli ID sono stabili e distinti per sede; i nomi visualizzati potranno evolvere.
   "race" è una denominazione didattica, non un tipo di attività dello scanner. */
(function(){
  'use strict';
  const out=[];
  function add(sede,categoria,nomi){
    nomi.forEach(function(nome){
      const id=sede+'-'+nome.toUpperCase().replace(/\s+/g,'-');
      out.push(Object.freeze({id:id,sede:sede,categoria:categoria,nome:nome,attivo:true}));
    });
  }
  add('MFZ','U12 Kids',['U12 Kids-1','U12 Kids-2','U12 Kids-3']);
  add('MFZ','U12 Rookie',['U12 Rookie-1','U12 Rookie-2','U12 Rookie-3']);
  add('MFZ','U18',['U18-1','U18-2','U18-race']);
  add('MFZ','Master',['Master-1','Master-2','Master-3']);
  add('PIN','U12 Rookie',['U12 Rookie-1','U12 Rookie-2','U12 Rookie-3']);
  add('PIN','U18',['U18-1','U18-2','U18-race']);
  // Race e Minienduro: gruppi aggiuntivi in ciascuna delle tre sedi.
  for (const sede of ['MFZ','PIN','OUT']) {
    add(sede,'Race',['Race']);
    add(sede,'Minienduro',['Minienduro']);
  }
  // Outdoor: stessa gamma di gruppi delle sedi esistenti, senza duplicati.
  add('OUT','U12 Kids',['U12 Kids-1','U12 Kids-2','U12 Kids-3']);
  add('OUT','U12 Rookie',['U12 Rookie-1','U12 Rookie-2','U12 Rookie-3']);
  add('OUT','U18',['U18-1','U18-2','U18-race']);
  add('OUT','Master',['Master-1','Master-2','Master-3']);
  window.ONELEVEN_GRUPPI=Object.freeze(out);
})();
