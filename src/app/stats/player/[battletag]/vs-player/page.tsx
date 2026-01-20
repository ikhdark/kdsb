type PageProps = {
  params: { battletag: string };
};

export default function SummaryPage({ params }: PageProps) {
  const battletag = decodeURIComponent(params.battletag);

  return (
    <div>
      <h1 className="text-xl font-bold">Player Summary</h1>
      <p className="text-sm text-gray-500">{battletag}</p>
    </div>
  );
}
