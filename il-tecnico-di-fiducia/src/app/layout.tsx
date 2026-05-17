import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Il tecnico di fiducia",
  description: "Trova il tuo esperto professionale in Italia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-on-background font-body-md">
        {children}
      </body>
    </html>
  );
}
