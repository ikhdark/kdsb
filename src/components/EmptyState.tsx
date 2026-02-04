export default function EmptyState({
  message = "Not enough data or recent games available",
}: {
  message?: string;
}) {
  return (
    <div className="py-16 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}