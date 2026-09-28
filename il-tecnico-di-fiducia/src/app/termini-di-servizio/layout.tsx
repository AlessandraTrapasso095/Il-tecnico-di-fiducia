import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/termini-di-servizio",
  },
};

export default function PublicRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
