import { notFound } from "next/navigation";
import { getW3CHeroStats } from "@/services/playerHeroes";

type PageProps = {
  params: Promise<{ battletag: string }>;
};

export default async function HeroesPage({ params }: PageProps) {
  const { battletag } = await params;
  if (!battletag) notFound();

  const decodedTag = decodeURIComponent(battletag);
  const data = await getW3CHeroStats(decodedTag);
  if (!data) notFound();

  // Split into logical sections (service already formats this way)
  const sections = data.result
    .split("\n\n")
    .map(s => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6 rounded-lg bg-white p-6 shadow dark:bg-gray-dark">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-black dark:text-white">
          Hero Statistics
        </h1>
        <p className="text-sm text-gray-500">
          {decodedTag} · Season 23 · All Races
        </p>
      </div>

      {/* Sections */}
      {sections.map((block, i) => {
        const lines = block.split("\n");
        const title = lines[0];
        const body = lines.slice(1);

        return (
          <section key={i}>
            <h2 className="mb-2 font-semibold text-black dark:text-white">
              {title.replace(/^📊\s*/, "")}
            </h2>

            <div className="space-y-1 text-sm text-black dark:text-white">
              {body.map((line, j) => (
                <div key={j}>{line}</div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
