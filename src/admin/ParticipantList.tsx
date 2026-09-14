import { useState } from "react";
import { Download, Search, Users } from "lucide-react";
import type { Participant } from "../types";
import { downloadCsv } from "../utils/csvExport";
export function ParticipantList({ records }: { records: Participant[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const filtered = [...records]
    .reverse()
    .filter((r) =>
      [r.name, r.company, r.phone, r.email, r.prizeName].some((s) =>
        s.toLowerCase().includes(query.toLowerCase()),
      ),
    );
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>참여자 목록</h2>
          <p>현재 기기에 저장된 참여 기록입니다. CSV로 백업해 주세요.</p>
        </div>
        <button
          className="button primary"
          onClick={() => downloadCsv(filtered)}
          disabled={!filtered.length}
        >
          <Download size={19} />
          CSV 다운로드
        </button>
      </div>
      <div className="card participant-card">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={19} />
            <input
              aria-label="참여자 검색"
              placeholder="이름, 회사, 연락처, 경품 검색"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <span>총 {filtered.length.toLocaleString()}건</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>날짜 / 시간</th>
                <th>이름</th>
                <th>회사</th>
                <th>연락처</th>
                <th>이메일</th>
                <th>당첨 상품</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice(current * pageSize, (current + 1) * pageSize)
                .map((record) => (
                  <tr key={record.id}>
                    <td>
                      {new Date(record.time).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        hour12: false,
                      })}
                    </td>
                    <td>{record.name || "설문 참여자"}</td>
                    <td>{record.company || "—"}</td>
                    <td>{record.phone || "—"}</td>
                    <td>{record.email || "—"}</td>
                    <td>
                      <span className={`tag ${record.isLose ? "" : "purple"}`}>
                        {record.prizeName}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="empty-state">
            <Users size={32} />
            <h3>아직 참여 기록이 없어요.</h3>
            <p>방문객이 룰렛에 참여하면 여기에 표시됩니다.</p>
          </div>
        )}
        <div className="pagination">
          <button
            className="button secondary"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            이전
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            className="button secondary"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            다음
          </button>
        </div>
      </div>
    </>
  );
}
