import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/contattaci",
  },
};

export default function PublicRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
