export default function Loading() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-gray-500">Loading player stats…</p>
      </div>
    </div>
  );
}
