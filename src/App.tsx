import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Maximize,
  Sparkles,
  Gift,
  ClipboardCheck,
  MousePointer2,
  Settings,
  VolumeX,
} from "lucide-react";
import { Logo } from "./components/Logo";
import { PrizeLineup } from "./components/PrizeLineup";
import { prizeRank } from "./utils/prizeRank";
import { RouletteWheel } from "./components/RouletteWheel";
import { CustomerForm } from "./components/CustomerForm";
import { ResultModal } from "./components/ResultModal";
import {
  fetchBundledConfig,
  fetchPublishedConfig,
  isNewerRevision,
} from "./utils/github";
import {
  finishParticipant,
  readStore,
  saveConfig,
  startSpin,
  STORAGE_KEY,
  writeStore,
} from "./utils/storage";
import {
  effectiveProbability,
  eligiblePrizes,
  eventStatus,
  indexAtPointer,
} from "./utils/rouletteLogic";
import type { Customer } from "./types";
export default function App() {
  const [state, setState] = useState(readStore);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!!state.pending);
  const [phase, setPhase] = useState<"idle" | "spinning" | "result">(
    state.pending ? "result" : "idle",
  );
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("설정 확인 중");
  const [now, setNow] = useState(Date.now());
  const wheelRef = useRef<SVGSVGElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const touchGuard = useRef(false);
  const config = state.config;
  const pending = state.pending;
  const spinning = phase === "spinning";
  useEffect(() => {
    let cancelled = false;
    let pollCount = 0;
    async function sync(fresh = true) {
      try {
        const saved = readStore();
        if (saved.pending) return;
        let remote;
        try {
          remote = await fetchPublishedConfig(fresh);
          if (!cancelled) setConnection("공통 설정 연결됨");
        } catch {
          remote =
            saved.config.revision === "initial"
              ? await fetchBundledConfig()
              : null;
          if (!cancelled) setConnection("기기 저장 설정 사용 중");
        }
        if (cancelled) return;
        if (
          remote &&
          !readStore().pending &&
          !readStore().config.revision.startsWith("local-") &&
          isNewerRevision(remote.revision, readStore().config.revision)
        )
          setState(saveConfig(remote));
      } catch {
        if (!cancelled) setConnection("기기 저장 설정 사용 중");
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) writeStore(state);
    } catch (e) {
      setError((e as Error).message);
    }
    void sync();
    const timer = setInterval(() => {
      setNow(Date.now());
      void sync(++pollCount % 5 === 0);
    }, 60000);
    const storage = () => {
      try {
        const next = readStore();
        setState(next);
        if (next.pending && !touchGuard.current) setPhase("result");
      } catch (e) {
        setError((e as Error).message);
      }
    };
    const online = () => {
      void sync();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("online", online);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("storage", storage);
      window.removeEventListener("online", online);
    };
  }, []);
  useEffect(() => {
    if (!spinning || !pending) return;
    let frame = 0;
    let lastIndex = -1;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduced ? 700 : pending.duration;
    const uprightImages = wheelRef.current?.querySelectorAll<SVGGElement>(
      "[data-wheel-upright]",
    );
    const start = performance.now();
    function animate(time: number) {
      const progress = Math.min(1, (time - start) / duration);
      const rotation = pending!.target * (1 - Math.pow(1 - progress, 4));
      if (wheelRef.current)
        wheelRef.current.style.transform = `rotate(${rotation}deg)`;
      uprightImages?.forEach((image) =>
        image.setAttribute("transform", `rotate(${-rotation})`),
      );
      const index = indexAtPointer(rotation, pending!.wheel.length);
      if (index !== lastIndex && pointerRef.current) {
        pointerRef.current.classList.remove("tick");
        void pointerRef.current.offsetWidth;
        pointerRef.current.classList.add("tick");
        lastIndex = index;
        window.dispatchEvent(
          new CustomEvent("carimatec-wheel-tick", { detail: { index } }),
        );
      }
      if (progress < 1) frame = requestAnimationFrame(animate);
      else {
        setPhase("result");
        touchGuard.current = false;
      }
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [spinning, pending?.record.id]);
  async function spin(customer: Customer) {
    if (touchGuard.current) return;
    touchGuard.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await startSpin(customer);
      setState(next);
      setFormOpen(false);
      setPhase("spinning");
    } catch (e) {
      setError((e as Error).message);
      touchGuard.current = false;
    } finally {
      setBusy(false);
    }
  }
  function nextParticipant() {
    try {
      setState(finishParticipant());
      setPhase("idle");
      setError("");
      touchGuard.current = false;
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else setError("브라우저 메뉴의 전체 화면 기능을 사용해 주세요.");
    } catch {
      setError("브라우저 메뉴의 전체 화면 기능을 사용해 주세요.");
    }
  }
  const available = eligiblePrizes(config, state.used).length > 0;
  const unavailable =
    eventStatus(config, new Date(now)) ||
    (!available
      ? "준비된 경품이 모두 소진되었습니다. 운영자에게 문의해 주세요."
      : "");
  const wheelPrizes = pending?.wheel || config.prizes.filter((p) => p.active);
  const lineupPrizes = wheelPrizes.map((prize, index) => ({
    ...prize,
    rankLabel: prizeRank(
      prize,
      Math.max(
        index,
        config.prizes.findIndex((p) => p.id === prize.id),
      ),
    ),
  }));
  const probabilities = Object.fromEntries(
    wheelPrizes.map((p) => [p.id, effectiveProbability(p, config, state.used)]),
  );
  return (
    <div
      className={`visitor theme-${config.display.theme} layout-${config.display.layout}`}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="tech-lines" />
      <header className="visitor-header">
        <Logo inverse={config.display.theme === "dark"} />
        <div className="event-badge">
          <span className="status-dot" />
          {config.event.name}
          <span className="badge-divider" />
          BOOTH EVENT
        </div>
        <button
          className="icon-button fullscreen"
          aria-label="전체 화면"
          onClick={() => void fullscreen()}
        >
          <Maximize size={22} />
        </button>
      </header>
      <main className="event-main">
        <section className="event-copy">
          <h1>
            <span>{config.event.mainTitle}</span>
            <span className="purple-text">
              {config.event.subTitle}
              <span className="title-spark">✳</span>
            </span>
          </h1>
          <p className="event-guide">{config.event.guide}</p>
          <div className="event-steps">
            <span>
              <ClipboardCheck size={19} />
              <b>01</b> 설문 참여
            </span>
            <i />
            <span>
              <MousePointer2 size={19} />
              <b>02</b> 룰렛 터치
            </span>
            <i />
            <span>
              <Gift size={19} />
              <b>03</b> 경품 수령
            </span>
          </div>
          <div className="copy-bottom">
            <div className="small-rule" />
            <p>
              상상이 현실이 되는 기술,
              <br />
              <strong>오늘은 행운까지 함께.</strong>
            </p>
            <ArrowUpRight size={26} />
          </div>
        </section>
        <section className="roulette-stage">
          <div className="stage-caption">
            <Sparkles size={15} /> YOUR NEXT POSSIBILITY
          </div>
          <RouletteWheel
            ref={wheelRef}
            pointerRef={pointerRef}
            prizes={wheelPrizes}
            display={pending?.display || config.display}
            spinning={spinning}
            rotation={phase === "result" && pending ? pending.target : 0}
            probabilities={probabilities}
          />
          <div className="spin-controls">
            <button
              className={`button primary spin-button ${spinning ? "is-spinning" : ""}`}
              disabled={
                !ready || spinning || busy || !!pending || !!unavailable
              }
              onClick={() => {
                if (!touchGuard.current) {
                  setError("");
                  setFormOpen(true);
                }
              }}
            >
              <span>
                {!ready
                  ? "이벤트 준비 중…"
                  : spinning
                    ? "행운이 다가오고 있어요…"
                    : "룰렛 돌리기"}
              </span>
              {spinning ? (
                <span className="spinner" />
              ) : (
                <ArrowRight size={25} />
              )}
            </button>
            <p className="spin-helper" aria-live="polite">
              {(!ready ? "최신 이벤트 설정을 확인하고 있어요." : "") ||
                unavailable ||
                (spinning
                  ? "잠시만 기다려 주세요."
                  : "화면을 터치하고 행운을 확인하세요.")}
            </p>
          </div>
        </section>
        <PrizeLineup
          prizes={lineupPrizes}
          disabled={spinning || busy || !!pending}
        />
      </main>
      <footer className="visitor-footer">
        <span>
          BEYOND PRINTING. <strong>CREATE POSSIBILITIES.</strong>
        </span>
        <div>
          <VolumeX size={14} />
          <span>
            {config.event.startDate &&
              `${config.event.startDate.replace(/-/g, ".")} — ${config.event.endDate.replace(/-/g, ".")}`}
          </span>
          <a href="./admin.html" aria-label="관리자 페이지" title={connection}>
            <Settings size={18} />
          </a>
        </div>
      </footer>
      {error && (
        <div className="toast error" role="alert">
          {error}
          <button aria-label="알림 닫기" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {formOpen && (
        <CustomerForm
          config={config}
          onSubmit={(customer) => void spin(customer)}
          onClose={() => setFormOpen(false)}
          busy={busy}
        />
      )}
      {phase === "result" && pending && (
        <ResultModal prize={pending.prize} onNext={nextParticipant} />
      )}
    </div>
  );
}
