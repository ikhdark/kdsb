import WhatsNew from "@/components/WhatsNew";
import PlayerLandingPage from "@/components/PlayerLandingPage";

export default function Home() {
  return (
    <div className="space-y-10">
      {/* Search (primary action) */}
      <PlayerLandingPage />

      {/* What's new (secondary info) */}
      <WhatsNew />
    </div>
  );
}
