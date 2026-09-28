import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/cookie-policy",
  },
};

export default function PublicRouteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
