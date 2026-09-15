import { useState, type CSSProperties } from "react";
import { ArrowUpRight, Gift } from "lucide-react";
import type { Prize } from "../types";
import { assetUrl } from "./RouletteWheel";
import { Modal } from "./Modal";
import { prizeRank } from "../utils/prizeRank";

export function PrizeLineup({
  prizes,
  disabled = false,
}: {
  prizes: Prize[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const list = () => (
    <ol className="lineup-list">
      {prizes.map((prize, index) => (
        <li
          key={prize.id}
          className="lineup-item"
          data-lineup-id={prize.id}
          style={{ "--prize-color": prize.color } as CSSProperties}
        >
          <div className="lineup-image">
            {prize.image ? (
              <img
                src={assetUrl(prize.image)}
                alt={prize.name}
                draggable={false}
              />
            ) : (
              <Gift aria-hidden="true" />
            )}
          </div>
          <div className="lineup-info">
            <span className="lineup-rank">
              <i aria-hidden="true" />
              {prizeRank(prize, index)}
            </span>
            <strong className="lineup-name">{prize.name}</strong>
          </div>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      <aside
        className={`prize-lineup ${prizes.length > 5 ? "lineup-many" : ""}`}
        aria-label="이벤트 경품 목록"
        style={
          {
            "--prize-count": prizes.length,
            "--lineup-height": `${prizes.length * 94 + 100}px`,
          } as CSSProperties
        }
      >
        <div className="lineup-heading">
          <span>EVENT GIFTS</span>
          <h2>
            오늘의 경품 <small>{prizes.length}</small>
          </h2>
        </div>
        {list()}
        <button
          className="lineup-more"
          onClick={() => setOpen(true)}
          disabled={disabled}
        >
          전체 경품 보기 <ArrowUpRight size={17} />
        </button>
      </aside>
      {open && !disabled && (
        <Modal
          title="전체 경품 목록"
          className="lineup-modal"
          onClose={() => setOpen(false)}
        >
          <h2>오늘의 경품</h2>
          <p className="muted">색상 표시는 룰렛의 같은 색 영역과 연결됩니다.</p>
          {list()}
          <button
            className="button primary full"
            onClick={() => setOpen(false)}
          >
            확인
          </button>
        </Modal>
      )}
    </>
  );
}
