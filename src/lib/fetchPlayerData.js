export async function fetchPlayerData(endpoint, battletag) {
  const res = await fetch(
    `/api/${endpoint}?battletag=${encodeURIComponent(battletag)}`
  );

  if (!res.ok) {
    throw new Error("Failed to load data");
  }

  return res.json();
}
