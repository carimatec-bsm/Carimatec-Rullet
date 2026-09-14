import { useEffect, useId, useRef, useState } from "react";
import { Pipette } from "lucide-react";

type EyeDropperConstructor = new () => {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
};
const validHex = /^#[0-9a-f]{6}$/i;

export function SegmentColorPicker({
  name,
  value,
  onChange,
  onError,
}: {
  name: string;
  value: string;
  onChange: (color: string) => void;
  onError: (message: string) => void;
}) {
  const hintId = useId();
  const [hex, setHex] = useState(value.toUpperCase());
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState("");
  const active = useRef<AbortController | null>(null);
  const callbacks = useRef({ onChange, onError });
  callbacks.current = { onChange, onError };
  const EyeDropper = (window as Window & { EyeDropper?: EyeDropperConstructor })
    .EyeDropper;
  const supported = window.isSecureContext && !!EyeDropper;

  useEffect(() => setHex(value.toUpperCase()), [value]);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );

  async function pick() {
    if (!supported || !EyeDropper || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPicking(true);
    setNotice("");
    try {
      // Must run directly from the user's click to retain browser activation.
      const result = await new EyeDropper().open({ signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!validHex.test(result.sRGBHex)) throw new Error("Invalid color");
      callbacks.current.onChange(result.sRGBHex.toUpperCase());
      setNotice("선택한 색상을 반영했습니다. 저장 버튼을 눌러 저장하세요.");
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof DOMException && error.name === "AbortError") {
        setNotice("색상 선택을 취소했습니다. 기존 색상은 유지됩니다.");
      } else {
        callbacks.current.onError(
          "스포이드를 열 수 없습니다. 다시 시도하거나 색상표 / HEX 입력을 사용하세요.",
        );
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setPicking(false);
      }
    }
  }

  return (
    <div className="segment-color-field">
      <span>세그먼트 색상</span>
      <div className="segment-color-controls">
        <div className="color-input">
          <input
            type="color"
            aria-label={`${name} 세그먼트 색상`}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              setNotice("");
            }}
          />
          <input
            className="hex-input"
            type="text"
            aria-label={`${name} 색상 HEX`}
            aria-describedby={hintId}
            value={hex}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => {
              const next = event.target.value.toUpperCase();
              setHex(next);
              setNotice("");
              if (validHex.test(next)) onChange(next);
            }}
            onBlur={() => {
              if (!validHex.test(hex)) {
                setHex(value.toUpperCase());
                setNotice(
                  "#7030A0처럼 6자리 HEX를 입력하세요. 기존 색상은 유지됩니다.",
                );
              }
            }}
          />
        </div>
        <button
          type="button"
          className="button secondary eyedropper-button"
          aria-label={`${name} 색상 스포이드`}
          aria-describedby={hintId}
          disabled={!supported || picking}
          onClick={pick}
        >
          <Pipette size={18} /> {picking ? "선택 중…" : "스포이드"}
        </button>
      </div>
      <p className="color-hint" id={hintId}>
        {supported
          ? "스포이드로 화면의 색상을 선택하세요. Esc를 누르면 취소됩니다."
          : "이 브라우저는 화면 스포이드를 지원하지 않습니다. 색상표 또는 HEX 입력을 사용하세요."}
      </p>
      <p className="color-notice" role="status">
        {notice}
      </p>
    </div>
  );
}
