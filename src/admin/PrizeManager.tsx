import { useState } from "react";
import {
  Plus,
  Trash2,
  ImagePlus,
  Gift,
  Package,
  ChevronDown,
} from "lucide-react";
import type { Config, Prize } from "../types";
import { makeId } from "../utils/storage";
import { compressImage } from "../utils/imageUpload";
import { assetUrl } from "../components/RouletteWheel";
import {
  effectiveProbability,
  probabilityTotal,
  remaining,
} from "../utils/rouletteLogic";
import { Modal } from "../components/Modal";
import { SegmentColorPicker } from "./SegmentColorPicker";
export function PrizeManager({
  config,
  update,
  used,
  onError,
}: {
  config: Config;
  update: (config: Config) => void;
  used: Record<string, number>;
  onError: (s: string) => void;
}) {
  const [deleteId, setDeleteId] = useState("");
  const [uploading, setUploading] = useState("");
  const change = (id: string, patch: Partial<Prize>) =>
    update({
      ...config,
      prizes: config.prizes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  const total = probabilityTotal(config.prizes);
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>경품을 구성해 보세요.</h2>
          <p>색상부터 확률까지, 변경한 내용을 오른쪽에서 확인하세요.</p>
        </div>
        <button
          className="button secondary"
          disabled={config.prizes.length >= 12}
          onClick={() =>
            update({
              ...config,
              prizes: [
                ...config.prizes,
                {
                  id: `prize-${makeId()}`,
                  name: "새 경품",
                  label: "새 경품",
                  description: "",
                  image: "",
                  color: "#7030A0",
                  weight: 0,
                  initialStock: 50,
                  unlimited: false,
                  active: true,
                  isLose: false,
                },
              ],
            })
          }
        >
          <Plus size={19} />
          경품 추가
        </button>
      </div>
      <div className="prize-list">
        {config.prizes.map((prize, index) => (
          <details
            className="prize-editor card"
            key={prize.id}
            open={index === 0 || undefined}
          >
            <summary>
              <span
                className="prize-number"
                style={{ background: prize.color }}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
              </span>
              <div className="prize-summary">
                <strong>{prize.name || "이름 없는 경품"}</strong>
                <span>
                  {prize.active
                    ? `${prize.weight}% · ${prize.isLose ? "꽝" : prize.unlimited ? "무제한" : `잔여 ${remaining(prize, used)} / ${prize.initialStock}개`}`
                    : "비활성 상품"}
                </span>
              </div>
              <span className={`tag ${prize.active ? "purple" : ""}`}>
                {prize.active ? "활성" : "비활성"}
              </span>
              <ChevronDown size={18} />
            </summary>
            <div className="prize-body">
              <div className="prize-top">
                <div className="upload-preview">
                  {prize.image ? (
                    <img
                      src={assetUrl(prize.image)}
                      alt={`${prize.name} 미리보기`}
                    />
                  ) : (
                    <Gift size={36} />
                  )}
                  <label className="upload-control" title="이미지 변경">
                    <ImagePlus size={19} />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label={`${prize.name} 이미지 업로드`}
                      disabled={!!uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setUploading(prize.id);
                        try {
                          change(prize.id, {
                            image: await compressImage(file),
                          });
                        } catch (err) {
                          onError((err as Error).message);
                        } finally {
                          setUploading("");
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="upload-description">
                  <strong>
                    {uploading === prize.id
                      ? "이미지 최적화 중…"
                      : "상품 이미지"}
                  </strong>
                  <p>
                    PNG · JPG · WEBP / 권장 600 × 600px
                    <br />
                    최대 10MB, 저장 시 자동 압축
                  </p>
                  {prize.image && (
                    <button
                      className="text-button"
                      onClick={() => change(prize.id, { image: "" })}
                    >
                      이미지 제거
                    </button>
                  )}
                </div>
              </div>
              <div className="form-grid">
                <label>
                  상품명
                  <input
                    maxLength={80}
                    value={prize.name}
                    onChange={(e) => change(prize.id, { name: e.target.value })}
                  />
                </label>
                <label>
                  룰렛 표시 이름
                  <input
                    maxLength={40}
                    value={prize.label}
                    onChange={(e) =>
                      change(prize.id, { label: e.target.value })
                    }
                  />
                </label>
                <label className="span-two">
                  상품 설명
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={prize.description}
                    onChange={(e) =>
                      change(prize.id, { description: e.target.value })
                    }
                  />
                </label>
                <SegmentColorPicker
                  name={prize.name}
                  value={prize.color}
                  onChange={(color) => change(prize.id, { color })}
                  onError={onError}
                />
                <label>
                  초기 상품 수량
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    step={1}
                    value={prize.initialStock}
                    disabled={prize.unlimited || prize.isLose}
                    onChange={(e) =>
                      change(prize.id, { initialStock: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <div className="probability-editor">
                <label>
                  당첨 확률{" "}
                  <div className="number-unit">
                    <input
                      aria-label={`${prize.name} 당첨 확률`}
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={prize.weight}
                      onChange={(e) =>
                        change(prize.id, { weight: Number(e.target.value) })
                      }
                    />
                    <span>%</span>
                  </div>
                </label>
                <input
                  aria-label={`${prize.name} 확률 슬라이더`}
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={prize.weight}
                  onChange={(e) =>
                    change(prize.id, { weight: Number(e.target.value) })
                  }
                />
                <small>
                  현재 재고 반영 확률{" "}
                  {effectiveProbability(prize, config, used).toFixed(2)}%
                </small>
              </div>
              <div className="prize-options">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={prize.active}
                    onChange={(e) =>
                      change(prize.id, { active: e.target.checked })
                    }
                  />
                  활성
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={prize.unlimited}
                    disabled={prize.isLose}
                    onChange={(e) =>
                      change(prize.id, { unlimited: e.target.checked })
                    }
                  />
                  수량 무제한
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={prize.isLose}
                    onChange={(e) =>
                      change(prize.id, { isLose: e.target.checked })
                    }
                  />
                  꽝 상품
                </label>
                <button
                  className="icon-button danger-text"
                  aria-label={`${prize.name} 삭제`}
                  disabled={config.prizes.length <= 2}
                  onClick={() => setDeleteId(prize.id)}
                >
                  <Trash2 size={19} />
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>
      <div
        className={`probability-total card ${Math.abs(total - 100) > 0.001 ? "invalid" : ""}`}
      >
        <div>
          <Package size={20} />
          <strong>활성 상품 확률 합계</strong>
        </div>
        <strong>
          {Number(total.toFixed(3))}
          <small> / 100%</small>
        </strong>
        {Math.abs(total - 100) > 0.001 && (
          <p>전체 당첨 확률의 합계가 100%가 되어야 합니다.</p>
        )}
      </div>
      <div className="card field-card">
        <label className="check-label">
          <input
            type="checkbox"
            checked={config.behavior.autoExclude}
            onChange={(e) =>
              update({
                ...config,
                behavior: { ...config.behavior, autoExclude: e.target.checked },
              })
            }
          />
          <span>재고 소진 상품 자동 제외 및 확률 재분배</span>
        </label>
        <p className="muted small">
          체크 해제 시 당첨 가능한 상품 중 하나라도 소진되면 이벤트를 일시
          중지합니다. 룰렛 칸은 동일 크기로 유지하며, 소진된 상품은 추첨에서
          제외됩니다.
        </p>
      </div>
      {deleteId && (
        <Modal title="상품 삭제 확인" onClose={() => setDeleteId("")}>
          <h2>이 상품을 삭제할까요?</h2>
          <p>
            이미 저장된 당첨 기록은 유지됩니다. 공통 설정에 저장하기 전까지 다른
            기기에는 반영되지 않습니다.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDeleteId("")}
            >
              취소
            </button>
            <button
              className="button danger"
              onClick={() => {
                update({
                  ...config,
                  prizes: config.prizes.filter((p) => p.id !== deleteId),
                });
                setDeleteId("");
              }}
            >
              삭제
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
