export function createTimeFrameExtractor(
  selectedTimeFrame: string | undefined,
) {
  const values = selectedTimeFrame?.split(",") ?? [];

  return (sectionKey: string) => {
    return values.find((value) => value === sectionKey);
  };
}
