import LiveMatches from "@/components/live/LiveMatches"

export default function LivePage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-black dark:text-white">
        Live 1v1 Matches
      </h1>

      <LiveMatches />
    </div>
  )
}