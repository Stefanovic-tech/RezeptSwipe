import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RezeptSwipe",
  description: "Rezepte gemeinsam entscheiden, kochen und einkaufen.",
  applicationName: "RezeptSwipe",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff5ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const t=localStorage.getItem('rs-theme');const m=t||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark', m==='dark');document.documentElement.dataset.theme=m;}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
