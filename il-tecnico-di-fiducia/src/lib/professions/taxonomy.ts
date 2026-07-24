export type ProfessionSubcategory = {
  name: string;
  slug: string;
};

export type DbProfessionSubcategory = ProfessionSubcategory & {
  id?: string;
  category_id?: number | string | null;
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
  | "architect"
  | "blacksmith"
  | "electrician"
  | "engineering"
  | "generic"
  | "informatics"
  | "law"
  | "mason"
  | "plumber"
  | "solar"
  | "surveyor"
  | "thermotechnic";

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
  avvocati: pexelsPhoto(6077123),
  elettricisti: pexelsPhoto(27928760),
  fabbri: pexelsPhoto(12310734),
  fotovoltaico: pexelsPhoto(35237908),
  generic: pexelsPhoto(6285142),
  geometri: pexelsPhoto(5802822),
  idraulici: pexelsPhoto(6419128),
  informatici: pexelsPhoto(5480781),
  ingegneri: pexelsPhoto(6285142),
  muratori: pexelsPhoto(6473984),
  termotecnici: pexelsPhoto(7859953),
} satisfies Record<string, string>;

export const CATEGORY_IMAGE_FALLBACK = categoryImages.generic;

export const PROFESSION_CATEGORIES: ProfessionCategory[] = [
  {
    id: null,
    name: "Ingegneri",
    slug: "ingegneri",
    image_url: categoryImages.ingegneri,
    icon: "engineering",
    source: "catalog",
    subcategories: [
      { name: "Strutturale", slug: "strutturale" },
      { name: "Energetica", slug: "energetica" },
      { name: "Impianti", slug: "impianti" },
      { name: "Sicurezza cantieri", slug: "sicurezza-cantieri" },
      { name: "Perizie tecniche", slug: "perizie-tecniche" },
    ],
  },
  {
    id: null,
    name: "Architetti",
    slug: "architetti",
    image_url: categoryImages.architetti,
    icon: "architect",
    source: "catalog",
    subcategories: [
      { name: "Progettazione", slug: "progettazione" },
      { name: "Interior design", slug: "interior-design" },
      { name: "Direzione lavori", slug: "direzione-lavori" },
      { name: "Pratiche edilizie", slug: "pratiche-edilizie" },
      { name: "Render e 3D", slug: "render-3d" },
    ],
  },
  {
    id: null,
    name: "Geometri",
    slug: "geometri",
    image_url: categoryImages.geometri,
    icon: "surveyor",
    source: "catalog",
    subcategories: [
      { name: "Rilievi topografici", slug: "rilievi-topografici" },
      { name: "Catasto", slug: "catasto" },
      { name: "CILA e SCIA", slug: "cila-scia" },
      { name: "Perizie", slug: "perizie" },
      { name: "Direzione lavori", slug: "direzione-lavori" },
    ],
  },
  {
    id: null,
    name: "Informatici",
    slug: "informatici",
    image_url: categoryImages.informatici,
    icon: "informatics",
    source: "catalog",
    subcategories: [
      { name: "Siti web", slug: "siti-web" },
      { name: "Reti e server", slug: "reti-server" },
      { name: "Cybersecurity", slug: "cybersecurity" },
      { name: "Assistenza software", slug: "assistenza-software" },
      { name: "Domotica", slug: "domotica" },
    ],
  },
  {
    id: null,
    name: "Avvocati",
    slug: "avvocati",
    image_url: categoryImages.avvocati,
    icon: "law",
    source: "catalog",
    subcategories: [
      { name: "Contratti", slug: "contratti" },
      { name: "Immobiliare", slug: "immobiliare" },
      { name: "Famiglia", slug: "famiglia" },
      { name: "Lavoro", slug: "lavoro" },
      { name: "Recupero crediti", slug: "recupero-crediti" },
    ],
  },
  {
    id: null,
    name: "Elettricisti",
    slug: "elettricisti",
    image_url: categoryImages.elettricisti,
    icon: "electrician",
    source: "catalog",
    subcategories: [
      { name: "Impianti civili", slug: "impianti-civili" },
      { name: "Quadri elettrici", slug: "quadri-elettrici" },
      { name: "Domotica", slug: "domotica" },
      { name: "Fotovoltaico", slug: "fotovoltaico" },
      { name: "Certificazioni", slug: "certificazioni" },
    ],
  },
  {
    id: null,
    name: "Idraulici",
    slug: "idraulici",
    image_url: categoryImages.idraulici,
    icon: "plumber",
    source: "catalog",
    subcategories: [
      { name: "Perdite", slug: "perdite" },
      { name: "Bagni", slug: "bagni" },
      { name: "Caldaie", slug: "caldaie" },
      { name: "Scarichi", slug: "scarichi" },
      { name: "Impianti idraulici", slug: "impianti-idraulici" },
    ],
  },
  {
    id: null,
    name: "Termotecnici",
    slug: "termotecnici",
    image_url: categoryImages.termotecnici,
    icon: "thermotechnic",
    source: "catalog",
    subcategories: [
      { name: "APE", slug: "ape" },
      { name: "Pompe di calore", slug: "pompe-di-calore" },
      { name: "Climatizzazione", slug: "climatizzazione" },
      { name: "Efficienza energetica", slug: "efficienza-energetica" },
      { name: "Impianti termici", slug: "impianti-termici" },
    ],
  },
  {
    id: null,
    name: "Fotovoltaico",
    slug: "fotovoltaico",
    image_url: categoryImages.fotovoltaico,
    icon: "solar",
    source: "catalog",
    subcategories: [
      { name: "Installazione pannelli", slug: "installazione-pannelli" },
      { name: "Manutenzione impianti", slug: "manutenzione-impianti" },
      { name: "Inverter e batterie", slug: "inverter-batterie" },
      { name: "Diagnosi consumi", slug: "diagnosi-consumi" },
      { name: "Pratiche GSE", slug: "pratiche-gse" },
    ],
  },
  {
    id: null,
    name: "Muratori",
    slug: "muratori",
    image_url: categoryImages.muratori,
    icon: "mason",
    source: "catalog",
    subcategories: [
      { name: "Ristrutturazioni", slug: "ristrutturazioni" },
      { name: "Pavimenti", slug: "pavimenti" },
      { name: "Cartongesso", slug: "cartongesso" },
      { name: "Intonaci", slug: "intonaci" },
      { name: "Manutenzioni", slug: "manutenzioni" },
    ],
  },
  {
    id: null,
    name: "Fabbri",
    slug: "fabbri",
    image_url: categoryImages.fabbri,
    icon: "blacksmith",
    source: "catalog",
    subcategories: [
      { name: "Serrature", slug: "serrature" },
      { name: "Infissi", slug: "infissi" },
      { name: "Cancelli", slug: "cancelli" },
      { name: "Ringhiere", slug: "ringhiere" },
      { name: "Pronto intervento", slug: "pronto-intervento" },
    ],
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
