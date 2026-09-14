import type { Participant } from "../types";
export function csvCell(value: string) {
  // Prevent spreadsheet formula injection, including whitespace-prefixed formulas.
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function toCsv(records: Participant[]) {
  const rows = [
    [
      "참가 ID",
      "이벤트 ID",
      "날짜/시간 (한국)",
      "이름",
      "회사",
      "연락처",
      "이메일",
      "당첨상품",
      "당첨 여부",
    ],
    ...records.map((r) => [
      r.id,
      r.eventId,
      new Date(r.time).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        hour12: false,
      }),
      r.name,
      r.company,
      r.phone,
      r.email,
      r.prizeName,
      r.isLose ? "미당첨" : "당첨",
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function downloadCsv(records: Participant[]) {
  downloadFile(
    toCsv(records),
    `carimatec_event_${new Date().toISOString().slice(0, 10)}.csv`,
    "text/csv;charset=utf-8",
  );
}
