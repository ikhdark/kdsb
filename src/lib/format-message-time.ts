export function formatMessageTime(timestamp: string) {
  const messageDate = new Date(timestamp);
  const now = new Date();

  const diffMs = now.getTime() - messageDate.getTime();
  const diffInMinutes = Math.max(0, Math.floor(diffMs / 60000));

  const sameDay =
    messageDate.toDateString() === now.toDateString();

  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  // Today
  if (sameDay) {
    if (diffInMinutes < 60) {
      return diffInMinutes === 0 ? "just now" : `${diffInMinutes}m`;
    }

    return messageDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // This week
  if (diffInDays < 7) {
    return messageDate.toLocaleDateString("en-US", { weekday: "long" });
  }

  // This year
  if (messageDate.getFullYear() === now.getFullYear()) {
    return messageDate.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
  }

  // Older
  return messageDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
