const escapeCsvValue = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const downloadCsv = (fileName, rows) => {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const csv = [
    columns.map(escapeCsvValue).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};
