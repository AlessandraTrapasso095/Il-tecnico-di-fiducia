export type ProfessionSubcategory = {
  id?: string;
  category_id?: number | string | null;
  name: string;
  slug: string;
};

export type DbProfessionSubcategory = ProfessionSubcategory & {
  sort_order?: number | null;
  is_active?: boolean | null;
};

export type DbProfessionCategory = {
  id: number | string | null;
  name: string;
  slug: string;
  image_url: string | null;
  description?: string | null;
  icon?: ProfessionIconName | string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  subcategories?: DbProfessionSubcategory[];
};

export type ProfessionIconName =
  | "accounting"
  | "agronomy"
  | "architect"
  | "blacksmith"
  | "ctu"
  | "electrician"
  | "engineering"
  | "geology"
  | "generic"
  | "informatics"
  | "industrial"
  | "interior"
  | "law"
  | "mason"
  | "notary"
  | "nutrition"
  | "plumber"
  | "psychology"
  | "solar"
  | "surveyor"
  | "thermotechnic"
  | "work-consultant";

export type ProfessionCategory = DbProfessionCategory & {
  icon: ProfessionIconName;
  source: "database" | "catalog";
  subcategories: ProfessionSubcategory[];
};

function pexelsPhoto(id: number) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900&h=620&fit=crop`;
}

const categoryImages = {
  architetti: pexelsPhoto(6615294),
  agronomi: pexelsPhoto(2886937),
  avvocati: pexelsPhoto(6077123),
  commercialisti: pexelsPhoto(669615),
  "consulenti-del-lavoro": pexelsPhoto(3184465),
  "ctu-ctp": pexelsPhoto(5668858),
  dietologi: pexelsPhoto(1640777),
  geologi: pexelsPhoto(5691622),
  generic: pexelsPhoto(6285142),
  geometri: pexelsPhoto(5802822),
  ingegneri: pexelsPhoto(6285142),
  informatici: pexelsPhoto(1181244),
  "interior-designer": pexelsPhoto(1571460),
  notai: pexelsPhoto(5668473),
  "periti-industriali": pexelsPhoto(3862130),
  psicologi: pexelsPhoto(4101143),
} satisfies Record<string, string>;

export const CATEGORY_IMAGE_FALLBACK = categoryImages.generic;

const PROFESSION_ICON_NAMES = new Set<ProfessionIconName>([
  "accounting",
  "agronomy",
  "architect",
  "blacksmith",
  "ctu",
  "electrician",
  "engineering",
  "geology",
  "generic",
  "informatics",
  "industrial",
  "interior",
  "law",
  "mason",
  "notary",
  "nutrition",
  "plumber",
  "psychology",
  "solar",
  "surveyor",
  "thermotechnic",
  "work-consultant",
]);

function professionSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function subcategoriesFrom(names: string[]) {
  return names.map((name) => ({ name, slug: professionSlug(name) }));
}

export const PROFESSION_CATEGORIES: ProfessionCategory[] = [
  {
    id: null,
    name: "Ingegneri",
    slug: "ingegneri",
    image_url: categoryImages.ingegneri,
    icon: "engineering",
    sort_order: 1000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Ingegneria civile e strutturale",
      "Ingegneria edile",
      "Ingegneria geotecnica",
      "Ingegneria idraulica",
      "Ingegneria ambientale",
      "Ingegneria dei trasporti",
      "Ingegneria impiantistica",
      "Ingegneria elettrica",
      "Ingegneria meccanica",
      "Ingegneria energetica",
      "Ingegneria industriale",
      "Ingegneria informatica",
      "Ingegneria elettronica",
      "Ingegneria delle telecomunicazioni",
      "Ingegneria gestionale",
      "Ingegneria biomedica",
      "Sicurezza sul lavoro",
      "Prevenzione incendi",
      "Certificazioni energetiche",
      "Collaudi e verifiche strutturali",
      "Perizie e consulenze tecniche",
      "Direzione lavori",
      "Coordinamento della sicurezza",
      "Pratiche sismiche",
      "Acustica",
      "Progettazione BIM",
    ]),
  },
  {
    id: null,
    name: "Architetti",
    slug: "architetti",
    image_url: categoryImages.architetti,
    icon: "architect",
    sort_order: 2000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Progettazione architettonica",
      "Ristrutturazioni",
      "Nuove costruzioni",
      "Progettazione residenziale",
      "Progettazione commerciale",
      "Progettazione direzionale",
      "Restauro e conservazione",
      "Riqualificazione edilizia",
      "Urbanistica e pianificazione",
      "Architettura del paesaggio",
      "Progettazione di interni",
      "Allestimenti",
      "Pratiche edilizie",
      "Direzione lavori",
      "Coordinamento della sicurezza",
      "Certificazioni energetiche",
      "Render e visualizzazione 3D",
      "Progettazione BIM",
      "Accessibilità e abbattimento barriere architettoniche",
      "Perizie e consulenze tecniche",
    ]),
  },
  {
    id: null,
    name: "Geometri",
    slug: "geometri",
    image_url: categoryImages.geometri,
    icon: "surveyor",
    sort_order: 3000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Pratiche catastali",
      "Accatastamenti",
      "Variazioni catastali",
      "Visure e planimetrie",
      "Rilievi topografici",
      "Riconfinamenti",
      "Frazionamenti",
      "Successioni e volture catastali",
      "Pratiche edilizie",
      "CILA, SCIA e permessi di costruire",
      "Sanatorie edilizie",
      "Condoni edilizi",
      "Computi metrici",
      "Stime immobiliari",
      "Perizie tecniche",
      "Tabelle millesimali",
      "Direzione lavori",
      "Coordinamento della sicurezza",
      "Certificazioni energetiche",
      "Progettazione e ristrutturazione",
      "Due diligence immobiliare",
    ]),
  },
  {
    id: null,
    name: "Periti industriali",
    slug: "periti-industriali",
    image_url: categoryImages["periti-industriali"],
    icon: "industrial",
    sort_order: 4000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Elettrotecnica",
      "Elettronica",
      "Automazione industriale",
      "Informatica",
      "Telecomunicazioni",
      "Meccanica",
      "Termotecnica",
      "Impianti elettrici",
      "Impianti termici",
      "Impianti di climatizzazione",
      "Impianti fotovoltaici",
      "Efficienza energetica",
      "Prevenzione incendi",
      "Sicurezza sul lavoro",
      "Acustica",
      "Chimica",
      "Edilizia",
      "Progettazione impiantistica",
      "Collaudi e verifiche",
      "Perizie tecniche",
      "Certificazioni energetiche",
    ]),
  },
  {
    id: null,
    name: "Informatici",
    slug: "informatici",
    image_url: categoryImages.informatici,
    icon: "informatics",
    sort_order: 15000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Sviluppo siti web",
      "E-commerce",
      "Web application",
      "Software desktop",
      "Software gestionali",
      "App Android",
      "App iOS",
      "App multipiattaforma",
      "Sviluppo backend",
      "Sviluppo frontend",
      "Full Stack Development",
      "API e integrazioni",
      "Database e progettazione dati",
      "Cloud e DevOps",
      "Cybersecurity",
      "Sicurezza informatica",
      "Networking",
      "Sistemi e server",
      "Virtualizzazione",
      "Intelligenza Artificiale",
      "Machine Learning",
      "AI Agents e automazioni",
      "Data Science",
      "Business Intelligence",
      "UI/UX Design",
      "SEO tecnica",
      "Performance e ottimizzazione",
      "Assistenza informatica",
      "Recupero dati",
      "Consulenza IT",
      "Domotica e IoT",
      "Blockchain e Smart Contract",
      "Sviluppo videogiochi",
      "Computer Vision",
      "Prompt Engineering",
    ]),
  },
  {
    id: null,
    name: "Geologi",
    slug: "geologi",
    image_url: categoryImages.geologi,
    icon: "geology",
    sort_order: 5000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Geologia tecnica",
      "Geotecnica",
      "Indagini geologiche",
      "Relazioni geologiche",
      "Studi di fattibilità",
      "Rischio idrogeologico",
      "Frane e dissesti",
      "Stabilità dei versanti",
      "Idrogeologia",
      "Ricerca e gestione delle acque",
      "Geologia ambientale",
      "Bonifica siti contaminati",
      "Caratterizzazione dei terreni",
      "Geofisica",
      "Sismica e microzonazione",
      "Geologia applicata alle costruzioni",
      "Cave e attività estrattive",
      "Monitoraggio ambientale",
      "Consulenze e perizie geologiche",
      "Pianificazione territoriale",
    ]),
  },
  {
    id: null,
    name: "Agronomi",
    slug: "agronomi",
    image_url: categoryImages.agronomi,
    icon: "agronomy",
    sort_order: 6000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Consulenza agronomica",
      "Progettazione agricola",
      "Gestione aziende agricole",
      "Coltivazioni e produzioni vegetali",
      "Olivicoltura",
      "Viticoltura",
      "Frutticoltura",
      "Orticoltura",
      "Agricoltura biologica",
      "Irrigazione",
      "Fertilizzazione",
      "Difesa fitosanitaria",
      "Verde urbano",
      "Progettazione di giardini e parchi",
      "Arboricoltura",
      "Valutazione stabilità alberi",
      "Selvicoltura",
      "Gestione forestale",
      "Stime e perizie agrarie",
      "Sviluppo rurale e finanziamenti",
      "Certificazioni agroalimentari",
      "Sicurezza alimentare",
      "Pianificazione del territorio rurale",
    ]),
  },
  {
    id: null,
    name: "Dietologi",
    slug: "dietologi",
    image_url: categoryImages.dietologi,
    icon: "nutrition",
    sort_order: 7000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Nutrizione clinica",
      "Dimagrimento e controllo del peso",
      "Educazione alimentare",
      "Dieta mediterranea",
      "Alimentazione vegetariana e vegana",
      "Nutrizione sportiva",
      "Nutrizione pediatrica",
      "Alimentazione in gravidanza e allattamento",
      "Menopausa",
      "Disturbi gastrointestinali",
      "Diabete e insulino-resistenza",
      "Colesterolo e dislipidemie",
      "Ipertensione",
      "Allergie e intolleranze alimentari",
      "Disturbi del comportamento alimentare",
      "Nutrizione oncologica",
      "Nutrizione geriatrica",
      "Diete per patologie metaboliche",
      "Valutazione della composizione corporea",
      "Piani alimentari personalizzati",
    ]),
  },
  {
    id: null,
    name: "Avvocati",
    slug: "avvocati",
    image_url: categoryImages.avvocati,
    icon: "law",
    sort_order: 8000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Diritto civile",
      "Diritto penale",
      "Diritto di famiglia",
      "Separazioni e divorzi",
      "Successioni ed eredità",
      "Diritto immobiliare",
      "Condominio e locazioni",
      "Recupero crediti",
      "Risarcimento danni",
      "Infortunistica stradale",
      "Diritto del lavoro",
      "Diritto societario",
      "Diritto commerciale",
      "Diritto tributario",
      "Diritto amministrativo",
      "Appalti pubblici",
      "Diritto fallimentare e crisi d’impresa",
      "Diritto bancario",
      "Diritto assicurativo",
      "Diritto dell’immigrazione",
      "Diritto internazionale",
      "Privacy e protezione dei dati",
      "Diritto digitale e nuove tecnologie",
      "Proprietà intellettuale",
      "Mediazione e negoziazione assistita",
    ]),
  },
  {
    id: null,
    name: "Commercialisti",
    slug: "commercialisti",
    image_url: categoryImages.commercialisti,
    icon: "accounting",
    sort_order: 9000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Contabilità e bilanci",
      "Dichiarazioni fiscali",
      "Consulenza fiscale",
      "Apertura e gestione partita IVA",
      "Regime forfettario",
      "Consulenza per imprese",
      "Costituzione di società",
      "Operazioni societarie",
      "Revisione legale",
      "Controllo di gestione",
      "Pianificazione finanziaria",
      "Pianificazione fiscale",
      "Crisi d’impresa",
      "Ristrutturazione aziendale",
      "Procedure concorsuali",
      "Perizie e valutazioni d’azienda",
      "Finanza agevolata",
      "Bonus e crediti d’imposta",
      "Contenzioso tributario",
      "Enti del Terzo settore",
      "Successioni e patrimoni",
      "Amministrazione e liquidazione societaria",
    ]),
  },
  {
    id: null,
    name: "Consulenti del lavoro",
    slug: "consulenti-del-lavoro",
    image_url: categoryImages["consulenti-del-lavoro"],
    icon: "work-consultant",
    sort_order: 10000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Elaborazione paghe e contributi",
      "Assunzioni",
      "Contratti di lavoro",
      "Licenziamenti e cessazioni",
      "Amministrazione del personale",
      "Consulenza previdenziale",
      "Consulenza contributiva",
      "Inquadramento dei lavoratori",
      "Contrattazione collettiva",
      "Relazioni sindacali",
      "Contenzioso del lavoro",
      "Ispezioni e vertenze",
      "Welfare aziendale",
      "Premi e incentivi",
      "Costo del lavoro",
      "Trasferte e rimborsi",
      "Lavoro domestico",
      "Colf e badanti",
      "Sicurezza e formazione del personale",
      "Agevolazioni per le assunzioni",
      "Gestione INPS, INAIL e casse",
      "Consulenza HR",
    ]),
  },
  {
    id: null,
    name: "Notai",
    slug: "notai",
    image_url: categoryImages.notai,
    icon: "notary",
    sort_order: 11000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Compravendite immobiliari",
      "Mutui e finanziamenti",
      "Contratti preliminari",
      "Donazioni",
      "Successioni",
      "Testamenti",
      "Accettazione e rinuncia all’eredità",
      "Patti di famiglia",
      "Convenzioni matrimoniali",
      "Separazione dei beni",
      "Contratti di convivenza",
      "Procure",
      "Atti societari",
      "Costituzione di società",
      "Modifiche statutarie",
      "Cessioni di quote",
      "Fusioni, scissioni e trasformazioni",
      "Verbali societari",
      "Costituzione di associazioni e fondazioni",
      "Atti relativi a terreni",
      "Servitù e divisioni immobiliari",
    ]),
  },
  {
    id: null,
    name: "CTU - CTP",
    slug: "ctu-ctp",
    image_url: categoryImages["ctu-ctp"],
    icon: "ctu",
    sort_order: 12000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Consulenza tecnica civile",
      "Consulenza tecnica edilizia",
      "Consulenza tecnica strutturale",
      "Consulenza tecnica impiantistica",
      "Consulenza tecnica immobiliare",
      "Estimo e valutazioni immobiliari",
      "Confini, catasto e topografia",
      "Vizi e difetti delle costruzioni",
      "Infiltrazioni e umidità",
      "Contabilità lavori e appalti",
      "Sicurezza sul lavoro",
      "Infortunistica stradale",
      "Ricostruzione incidenti",
      "Grafologia forense",
      "Informatica forense",
      "Consulenza contabile e societaria",
      "Consulenza bancaria",
      "Consulenza assicurativa",
      "Consulenza medico-legale",
      "Consulenza psicologica",
      "Consulenza agraria e forestale",
      "Consulenza geologica e geotecnica",
      "Stima danni",
      "Arbitrati e conciliazioni",
    ]),
  },
  {
    id: null,
    name: "Psicologi",
    slug: "psicologi",
    image_url: categoryImages.psicologi,
    icon: "psychology",
    sort_order: 13000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Psicologia clinica",
      "Psicoterapia",
      "Psicologia dell’età evolutiva",
      "Psicologia dell’adolescenza",
      "Psicologia dell’adulto",
      "Psicologia della coppia",
      "Psicologia della famiglia",
      "Sostegno alla genitorialità",
      "Ansia e attacchi di panico",
      "Depressione e disturbi dell’umore",
      "Stress e burnout",
      "Disturbi alimentari",
      "Dipendenze",
      "Trauma e lutto",
      "Neuropsicologia",
      "Psicologia scolastica",
      "Psicologia del lavoro",
      "Orientamento professionale",
      "Psicologia giuridica e forense",
      "Sessuologia",
      "Disturbi del sonno",
      "Supporto psicologico online",
    ]),
  },
  {
    id: null,
    name: "Interior designer",
    slug: "interior-designer",
    image_url: categoryImages["interior-designer"],
    icon: "interior",
    sort_order: 14000,
    source: "catalog",
    subcategories: subcategoriesFrom([
      "Progettazione di interni",
      "Arredamento residenziale",
      "Arredamento commerciale",
      "Home styling",
      "Home staging",
      "Ristrutturazione degli interni",
      "Distribuzione degli spazi",
      "Progettazione cucine",
      "Progettazione bagni",
      "Progettazione illuminotecnica",
      "Scelta di colori e materiali",
      "Progettazione arredi su misura",
      "Render 3D",
      "Modellazione 3D",
      "Allestimenti",
      "Retail design",
      "Hospitality design",
      "Uffici e spazi di lavoro",
      "Consulenza d’arredo online",
      "Shopping list e selezione fornitori",
    ]),
  },
];

export function professionCategoryKey(category: DbProfessionCategory) {
  return `category:${category.slug}`;
}

export function mergeProfessionCategories(categories: DbProfessionCategory[]) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const knownSlugs = new Set(PROFESSION_CATEGORIES.map((category) => category.slug));
  const merged = PROFESSION_CATEGORIES.map((category) => {
    const databaseCategory = bySlug.get(category.slug);

    return databaseCategory
      ? {
          ...category,
          id: databaseCategory.id,
          name: databaseCategory.name || category.name,
          image_url: databaseCategory.image_url || category.image_url,
          source: "database" as const,
        }
      : category;
  });

  const extraCategories = categories
    .filter((category) => !knownSlugs.has(category.slug))
    .map<ProfessionCategory>((category) => ({
      ...category,
      image_url: category.image_url || CATEGORY_IMAGE_FALLBACK,
      icon: "generic",
      source: "database",
      subcategories: category.subcategories ?? [],
    }));

  return [...merged, ...extraCategories];
}

export function normalizeProfessionCategories(categories: DbProfessionCategory[]) {
  return categories
    .filter((category) => category.is_active !== false && category.name && category.slug)
    .map<ProfessionCategory>((category) => ({
      ...category,
      image_url: category.image_url || CATEGORY_IMAGE_FALLBACK,
      icon: PROFESSION_ICON_NAMES.has(category.icon as ProfessionIconName)
        ? (category.icon as ProfessionIconName)
        : "generic",
      source: "database",
      subcategories: (category.subcategories ?? [])
        .filter(
          (subcategory) =>
            subcategory.is_active !== false && subcategory.name && subcategory.slug,
        )
        .sort(
          (left, right) =>
            (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
            left.name.localeCompare(right.name, "it"),
        )
        .map((subcategory) => ({
          id: subcategory.id,
          category_id: subcategory.category_id,
          name: subcategory.name,
          slug: subcategory.slug,
        })),
    }))
    .sort(
      (left, right) =>
        (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
        left.name.localeCompare(right.name, "it"),
    );
}

export function findProfessionCategory(categories: ProfessionCategory[], selectedKey: string) {
  return (
    categories.find((category) => professionCategoryKey(category) === selectedKey) ?? null
  );
}

export function professionSearchText(
  category: ProfessionCategory | null,
  subcategory: ProfessionSubcategory | null,
) {
  if (!category) return "";
  return [category.id === null ? category.name : "", subcategory?.name ?? ""]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}
