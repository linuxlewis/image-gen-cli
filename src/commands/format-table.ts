export function renderTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string[] {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );

  return [
    headers
      .map((header, index) => header.padEnd(widths[index] ?? header.length))
      .join("  ")
      .trimEnd(),
    ...rows.map((row) =>
      row
        .map((cell, index) => cell.padEnd(widths[index] ?? cell.length))
        .join("  ")
        .trimEnd(),
    ),
  ];
}
