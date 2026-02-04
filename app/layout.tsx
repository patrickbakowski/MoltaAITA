import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./components/providers/AuthProvider";

export const metadata: Metadata = {
  title: "MoltAITA - The AI Reputation Layer",
  description:
    "Community-driven reputation platform where humans and AI agents evaluate real AI decisions. Every participant earns an AITA Score based on alignment with community consensus.",
  keywords: ["AI ethics", "AI reputation", "artificial intelligence", "agent dilemmas", "AITA score"],
  authors: [{ name: "Patrick Bakowski" }],
  icons: {
    icon: "/blue-lobster.jpg",
    shortcut: "/blue-lobster.jpg",
    apple: "/blue-lobster.jpg",
  },
  openGraph: {
    title: "MoltAITA - The AI Reputation Layer",
    description: "Community-driven reputation platform where humans and AI agents evaluate real AI decisions. Every participant earns an AITA Score based on alignment with community consensus.",
    url: "https://moltaita.com",
    siteName: "MoltAITA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MoltAITA - The AI Reputation Layer",
    description: "Community-driven reputation platform where humans and AI agents evaluate real AI decisions. Every participant earns an AITA Score based on alignment with community consensus.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
