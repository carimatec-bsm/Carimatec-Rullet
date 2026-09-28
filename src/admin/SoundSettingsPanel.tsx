import { useEffect, useRef, useState } from "react";
import type { SoundSettings } from "../types";
import { soundSettings } from "../utils/soundEffects";
import { useSoundEffects } from "../hooks/useSoundEffects";

export function SoundSettingsPanel({
  value,
  onChange,
}: {
  value?: SoundSettings;
  onChange: (value: SoundSettings) => void;
}) {
  const settings = soundSettings(value);
  const sound = useSoundEffects();
  const request = useRef(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    request.current++;
    sound.stop();
    return () => {
      request.current++;
      sound.stop();
    };
  }, [settings.enabled, settings.volume, sound]);

  async function preview(kind: "spin" | "win") {
    const id = ++request.current;
    sound.stop();
    sound.configure({ ...settings, enabled: true });
    setMessage("");
    const ready = await sound.activate();
    if (id !== request.current || document.hidden) return;
    if (!ready) {
      setMessage(
        "소리를 재생하지 못했습니다. 기기 음량과 브라우저 설정을 확인한 뒤 다시 눌러 주세요.",
      );
      return;
    }
    if (kind === "spin") sound.previewSpin();
    else sound.celebrate();
  }
  return (
    <section className="card field-card sound-settings">
      <h3>효과음</h3>
      <label className="switch-row">
        <span>효과음 사용</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => onChange({ ...settings, enabled: e.target.checked })}
        />
        <span className="switch" />
      </label>
      <label className="sound-volume">
        효과음 음량 · {settings.volume}%
        <input
          aria-label="효과음 음량"
          type="range"
          min="0"
          max="100"
          step="5"
          value={settings.volume}
          onChange={(e) =>
            onChange({ ...settings, volume: Number(e.target.value) })
          }
        />
      </label>
      <div className="sound-preview-actions">
        <button
          className="button secondary"
          disabled={!settings.volume}
          onClick={() => void preview("spin")}
        >
          회전음 미리 듣기
        </button>
        <button
          className="button secondary"
          disabled={!settings.volume}
          onClick={() => void preview("win")}
        >
          축하음 미리 듣기
        </button>
        <button
          className="button secondary"
          onClick={() => {
            request.current++;
            sound.stop();
          }}
        >
          미리 듣기 중지
        </button>
      </div>
      <p className="muted small">
        기본 OFF · 미리 듣기는 OFF 상태에서도 재생됩니다. 방문객 화면의 스피커
        버튼은 해당 화면에서만 소리를 켜거나 끕니다. 새로고침하면 저장된 설정을
        따릅니다.
      </p>
      <p className="muted small">
        소리 재생은 첫 터치 후 활성화됩니다. 기기 자체 음량도 확인해 주세요.
        효과음을 사용할 수 없어도 룰렛은 정상 작동합니다.
      </p>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
