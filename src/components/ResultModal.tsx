import { Check, Gift, Sparkles, ArrowRight } from "lucide-react";
import type { Prize } from "../types";
import { Modal } from "./Modal";
import { assetUrl } from "./RouletteWheel";
export function ResultModal({
  prize,
  onNext,
}: {
  prize: Prize;
  onNext: () => void;
}) {
  return (
    <Modal title="룰렛 결과" className="result-modal">
      {!prize.isLose && (
        <div className="confetti" aria-hidden="true">
          {Array.from({ length: 25 }, (_, i) => (
            <i
              key={i}
              style={{
                left: `${(i * 37) % 100}%`,
                animationDelay: `${(i % 7) * 0.19}s`,
                background: ["#7030a0", "#c9a8e2", "#c3b39a"][i % 3],
                transform: `rotate(${i * 23}deg)`,
              }}
            />
          ))}
        </div>
      )}
      <span className="eyebrow">
        {prize.isLose ? "THANK YOU FOR JOINING" : "YOUR LUCKY MOMENT"}
      </span>
      <h2>{prize.isLose ? "함께해 주셔서 감사합니다" : "축하합니다!"}</h2>
      <div className="result-image">
        {prize.image ? (
          <img src={assetUrl(prize.image)} alt={prize.name} />
        ) : (
          <Gift size={80} />
        )}
      </div>
      <h3>{prize.name}</h3>
      <p className="muted">{prize.description}</p>
      {!prize.isLose && (
        <div className="result-hint">
          <Sparkles size={18} /> 이 화면을 부스 운영자에게 보여주세요.
        </div>
      )}
      <button className="button primary full" onClick={onNext}>
        <Check size={20} />
        확인 · 다음 참여자
        <ArrowRight size={20} />
      </button>
    </Modal>
  );
}
