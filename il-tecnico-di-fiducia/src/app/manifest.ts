import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Il Tecnico di Fiducia",
    short_name: "Tecnico di Fiducia",
    description:
      "Trova professionisti qualificati e mettiti in contatto con il tecnico più adatto alle tue esigenze.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#002654",
    lang: "it",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
