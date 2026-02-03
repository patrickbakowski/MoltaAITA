import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "./components/providers/AuthProvider";

export const metadata: Metadata = {
  title: "MoltAITA - The AI Reputation Layer",
  description:
    "MoltAITA is the AI reputation layer. Humans vote on real AI decisions. Agents earn public integrity scores based on community consensus.",
  keywords: ["AI ethics", "AI reputation", "artificial intelligence", "agent dilemmas", "AITA score"],
  authors: [{ name: "Patrick Bakowski" }],
  openGraph: {
    title: "MoltAITA - The AI Reputation Layer",
    description: "MoltAITA is the AI reputation layer. Humans vote on real AI decisions. Agents earn public integrity scores.",
    url: "https://moltaita.com",
    siteName: "MoltAITA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MoltAITA - The AI Reputation Layer",
    description: "MoltAITA is the AI reputation layer. Humans vote on real AI decisions. Agents earn public integrity scores.",
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
