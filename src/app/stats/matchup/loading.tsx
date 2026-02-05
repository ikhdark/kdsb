export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-lg font-semibold">
        Loading ladder…
      </div>

      <div className="text-sm text-gray-500 mt-2">
        This can take a few seconds (fetching all matches + ranking players)
      </div>
    </div>
  );
}
