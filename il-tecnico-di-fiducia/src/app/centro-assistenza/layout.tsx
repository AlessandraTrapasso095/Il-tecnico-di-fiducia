import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/centro-assistenza",
  },
};

export default function PublicRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
