# Categorie e sottocategorie — Fase 1

Questa fase introduce la gestione admin di categorie e sottocategorie senza sostituire il catalogo statico usato da homepage e ricerca.

## Ordine operativo

1. Applicare la migration:

```bash
npx supabase db push
```

2. Importare il catalogo statico attuale nel database:

```bash
node scripts/seed-profession-taxonomy.mjs
```

Lo script legge direttamente `src/lib/professions/taxonomy.ts`, quindi il catalogo non viene duplicato in un secondo elenco manuale.

## Compatibilità

- Il catalogo statico resta disponibile come fallback.
- Gli slug esistenti non vengono modificati.
- Il seed usa `slug` come chiave di compatibilità e può essere rieseguito senza duplicare record.
- Le categorie extra già presenti nel database non vengono eliminate.
- Le associazioni dei professionisti non vengono modificate.

## Gestione immagini

In questa fase l’admin può inserire o rimuovere un URL immagine. L’upload su Supabase Storage resta predisposto come evoluzione successiva.
