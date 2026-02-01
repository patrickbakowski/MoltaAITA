import { Hero } from "./components/Hero";
import { LiveFeed } from "./components/LiveFeed";
import { Pricing } from "./components/Pricing";
import { Footer } from "./components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <LiveFeed />
      <Pricing />
      <Footer />
    </main>
  );
}
