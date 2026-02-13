import LiveMatches from "@/components/live/LiveMatches"

export default function LivePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Live 1v1 Matches</h1>
      <LiveMatches />
    </div>
  )
}