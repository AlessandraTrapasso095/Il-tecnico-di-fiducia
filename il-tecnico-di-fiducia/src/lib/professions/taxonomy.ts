export type ProfessionSubcategory = {
  name: string;
  slug: string;
};

export type DbProfessionCategory = {
  id: number | null;
  name: string;
  slug: string;
  image_url: string | null;
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
  visualClass: string;
  source: "database" | "catalog";
  subcategories: ProfessionSubcategory[];
};

const categoryImages = {
  architetti:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCemy7B9P1kpymYEeupmx-XbZJbor21lsR3jFt0_2O7LDdqTipkZj9HclMYQXbIf4EfDK3ZjzjlWMhoBy4v3s58dSSf84zDT6k_CteC29vdcmSihTjOgt0SlsdiRaomsvxuVx8wlcxpYK2UUrXSZSUL72A4XmJToxUa9BHiRK24fjI5IM3sgqVU6BvpsReK9Sdl0Px18LhmT3-SPjEzv4xRVPoHsHt2a0iPJKq7T6nMsDQXi51M67xvk0GzJZ-PfaI2k3wvOujvYL6N",
  avvocati:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCpGguOIk8O9WjodNTRAptgdt5rbPdYg3BtA0ZgQ4KIjLPjI6eRlQO2jMlgnvj2ROIC6lx7LObwLac8BKaqBhjlc6UIxwGiSoZrVRfK69BZvUXUyLgGoACuFwmA9XLwKyNuscNkLMuUpsyh2fMWh6sy1OS6PkgpIll-QCsLiH3txOC9iG9mnEgb7l2H6BkDhQePlBqa4xROLfcpv-YaGBDMc3J5_rB1VY2YzOshgFAd1_x2K_h_g16uDVss5Uu_RQlkdl9NGAvyF2Do",
  elettricisti:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCQpvXQFlipYZ48NEsT-LZTRmvyOBOHiT2ebEU7F4uwGA-83zTRC5t1RPGYtAMbxUFxkpdkiIvIBFs9WgwiMYxturHn2w2os0sVZPtG8ZlXLJv_zJHXeD3w9iA4H95VazOu-XaBenq4EaKtYqINoMtenPz2g0IEwx9wZ3Nj92ho-vFKnlbdtT_eqzd-rO-NAvGRINmeHwousj4xkHtHNbnJBQVtEw7y1RrfJJWSlNJHo8ay0JzD1qC1j0BZ6umhOGA6DDnRzqhj1_-f",
  geometri:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCZjyAQrIYj9PpsLD914K3jCPsLWpvMEPfmR1DQm3cPuyzEi_e5YHYGDw9aY-mrabNjatIFzRTSD_yd02P2R_Sz26ensYbVkMIMXGbSn1LW9hNWy5fFHoiaIcMKarFyw604xQnP9NPfmpDA12FOLJmHKGmqT4Vc-Mbcrd4hnMFfMVV9mdsTGxUmgDbO_sllDG9HUso9vcBGhUQmsVMIEtv9nhG8NvZhBdOg6COtR_a37Yq8fyDyheKVzUILyWvF8b9ZZDDrvCUNM4_B",
  informatici:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuA0BRkP_kdLM5gmqNvA3ASa1eldNmGn217TsvbodTyYavS_zfg3ew2nMjLelsX4dZSAF5jDUOfttdhf6BtGMhVR13EoYshrJGSAmNeyRuboZaEEuEuFNyhnBoVMaRbWbanQr6mQG0HdfZxKmKeQS5FGprM89I3DvN2yAqZZATWRqUlsu9k8vkep6p36OVFp-Y3rlKRWwYoDdfHBl-PDnXt6PnXycSzDIh0ppOt87HJLYsykmPBS80ilw-liWpJ236AG6aNZNq0ozlWk",
  ingegneri:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCQq5eVwBnqFjCnN86gkFsD--RbpO8N_s6_TA8GUajyTqu6oCUaTiaYakGsIYitF-97_Uk2reoVX4o7Ng4T_MF88_bowkzm2cg9PS1J9iUrkKtX5eac3wL1W3xOqfUOopiVVwkf6Qys-QdMbxn0ya-kAXqG0hC5lqML96RMdvJwDkTcYRgEonQLxHro7pPizfQQbBcjo7XdkzM9baEGOBg3XOQ-oonbtWb9NJgHQjYmrdTpoSzSG9L5dPuzaczVjqWXc_OKVZUFfqfx",
} satisfies Record<string, string>;

export const PROFESSION_CATEGORIES: ProfessionCategory[] = [
  {
    id: null,
    name: "Ingegneri",
    slug: "ingegneri",
    image_url: categoryImages.ingegneri,
    icon: "engineering",
    visualClass: "from-[#001b3e] via-[#0b3c78] to-[#84a8eb]",
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
    visualClass: "from-[#0b3c78] via-[#435e94] to-[#d8e2ff]",
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
    visualClass: "from-[#1b4682] via-[#385e9c] to-[#ff8814]",
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
    visualClass: "from-[#001b3e] via-[#0b3c78] to-[#84a8eb]",
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
    visualClass: "from-[#411d00] via-[#703700] to-[#ffb783]",
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
    visualClass: "from-[#002654] via-[#0b3c78] to-[#ff8814]",
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
    image_url: null,
    icon: "plumber",
    visualClass: "from-[#082b5f] via-[#0b6d8f] to-[#aec6ff]",
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
    image_url: null,
    icon: "thermotechnic",
    visualClass: "from-[#002654] via-[#435e94] to-[#ff8814]",
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
    image_url: null,
    icon: "solar",
    visualClass: "from-[#002654] via-[#0b6d8f] to-[#ffb783]",
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
    image_url: null,
    icon: "mason",
    visualClass: "from-[#301400] via-[#703700] to-[#ffb783]",
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
    image_url: null,
    icon: "blacksmith",
    visualClass: "from-[#101828] via-[#293041] to-[#ff8814]",
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
      icon: "generic",
      visualClass: "from-[#002654] via-[#435e94] to-[#d8e2ff]",
      source: "database",
      subcategories: [],
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
