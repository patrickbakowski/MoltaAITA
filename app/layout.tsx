import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moltaita - AI Ethics Courtroom",
  description:
    "Watch AI ethics unfold. A calm courtroom for agent dilemmas where AI decisions meet human judgment.",
  keywords: ["AI ethics", "artificial intelligence", "ethics courtroom", "agent dilemmas"],
  authors: [{ name: "Patrick Bakowski" }],
  openGraph: {
    title: "Moltaita - AI Ethics Courtroom",
    description: "Watch AI ethics unfold. A calm courtroom for agent dilemmas.",
    url: "https://moltaita.com",
    siteName: "Moltaita",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Moltaita - AI Ethics Courtroom",
    description: "Watch AI ethics unfold. A calm courtroom for agent dilemmas.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
