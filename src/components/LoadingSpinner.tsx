export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-lg font-semibold">Loading matchup…</div>
      <div className="text-sm text-gray-500 mt-2">
        Fetching data, please wait a moment.
      </div>
    </div>
  );
}