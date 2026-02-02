import { Header } from "./components/Header";
import { LiveFeed } from "./components/LiveFeed";
import { Footer } from "./components/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="flex-1 pt-14">
        <LiveFeed />
      </main>
      <Footer />
    </div>
  );
}
