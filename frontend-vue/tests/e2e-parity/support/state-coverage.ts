/** Compare the registered terminal states with successful scans, including duplicates. */
export function stateCoverageFailures(
  expected: readonly string[],
  scanned: readonly string[],
) {
  const expectedSet = new Set(expected);
  const scannedSet = new Set(scanned);
  const duplicates = (keys: readonly string[]) =>
    [
      ...new Set(keys.filter((key, index) => keys.indexOf(key) !== index)),
    ].sort();
  return {
    missing: [...expectedSet].filter((key) => !scannedSet.has(key)).sort(),
    unexpected: [...scannedSet].filter((key) => !expectedSet.has(key)).sort(),
    duplicateExpected: duplicates(expected),
    duplicateScans: duplicates(scanned),
  };
}
