import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/professional",
  },
};

export default function PublicRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
