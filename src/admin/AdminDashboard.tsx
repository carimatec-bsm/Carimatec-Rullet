import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Gift,
  SlidersHorizontal,
  CalendarDays,
  Users,
  Settings,
  ArrowUpRight,
  Save,
  LogOut,
  CloudUpload,
  RefreshCw,
  Download,
  Upload,
  Check,
  LockKeyhole,
  ArrowRight,
  Sparkles,
  Trophy,
  Activity,
  X,
  Eye,
} from "lucide-react";
import type { Config, CustomerField, Store } from "../types";
import { ADMIN_PIN, cloneConfig, REPOSITORY } from "../data/defaultConfig";
import { Logo } from "../components/Logo";
import { Modal } from "../components/Modal";
import { RouletteWheel } from "../components/RouletteWheel";
import { fieldLabels } from "../components/CustomerForm";
import { PrizeManager } from "./PrizeManager";
import { ParticipantList } from "./ParticipantList";
import { makeId, readStore, resetData, saveConfig } from "../utils/storage";
import {
  fetchPublishedConfig,
  publishConfig,
  publicSettings,
  isNewerRevision,
} from "../utils/github";
import { validateConfig, assertConfig } from "../utils/validation";
import { downloadFile } from "../utils/csvExport";
import { remaining } from "../utils/rouletteLogic";
type Tab =
  "dashboard" | "prizes" | "display" | "event" | "participants" | "settings";
const tabs = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "prizes", label: "경품 관리", icon: Gift },
  { id: "display", label: "룰렛 디자인", icon: SlidersHorizontal },
  { id: "event", label: "이벤트 설정", icon: CalendarDays },
  { id: "participants", label: "참여자 목록", icon: Users },
  { id: "settings", label: "운영 및 데이터", icon: Settings },
] as const;
const sessionKey = "carimatec.admin.until";
function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="login-page">
      <Logo />
      <a className="login-back" href="./index.html">
        이벤트 화면으로 <ArrowUpRight size={16} />
      </a>
      <div className="login-card card">
        <div className="modal-symbol">
          <LockKeyhole size={29} />
        </div>
        <span className="eyebrow">EVENT CONTROL CENTER</span>
        <h1>운영자 로그인</h1>
        <p>관리자 PIN을 입력해 주세요.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const until = Number(
              sessionStorage.getItem("carimatec.pin.lock") || 0,
            );
            if (until > Date.now()) {
              setError("입력 횟수를 초과했습니다. 30초 후 다시 시도해 주세요.");
              return;
            }
            if (pin === ADMIN_PIN) {
              sessionStorage.setItem(
                sessionKey,
                String(Date.now() + 15 * 60000),
              );
              sessionStorage.removeItem("carimatec.pin.tries");
              onUnlock();
            } else {
              const tries =
                Number(sessionStorage.getItem("carimatec.pin.tries") || 0) + 1;
              sessionStorage.setItem("carimatec.pin.tries", String(tries));
              if (tries % 5 === 0)
                sessionStorage.setItem(
                  "carimatec.pin.lock",
                  String(Date.now() + 30000),
                );
              setError("PIN이 올바르지 않습니다. 다시 확인해 주세요.");
              setPin("");
            }
          }}
        >
          <label>
            관리자 PIN
            <input
              autoFocus
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="6자리 PIN"
            />
          </label>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={!pin}>
            로그인
            <ArrowRight size={20} />
          </button>
        </form>
        <small>현장 운영자를 위한 관리 화면입니다.</small>
      </div>
      <footer>CARIMATEC · CREATE POSSIBILITIES.</footer>
    </div>
  );
}
export function AdminDashboard() {
  const [unlocked, setUnlocked] = useState(
    () => Number(sessionStorage.getItem(sessionKey) || 0) > Date.now(),
  );
  const [state, setState] = useState<Store>(readStore);
  const [draft, setDraft] = useState<Config>(() => cloneConfig(state.config));
  const [tab, setTab] = useState<Tab>("dashboard");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [token, setToken] = useState("");
  const [baseline, setBaseline] = useState(
    state.config.baseRevision ||
      (state.config.revision.startsWith("local-")
        ? "initial"
        : state.config.revision),
  );
  const [resetOpen, setResetOpen] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const configRef = useRef(draft);
  configRef.current = draft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.config);
  const errors = validateConfig(draft);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (publishOpen) setNotice("");
  }, [publishOpen]);
  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    void fetchPublishedConfig()
      .then((remote) => {
        if (cancelled) return;
        const saved = readStore();
        if (
          JSON.stringify(configRef.current) !== JSON.stringify(saved.config) ||
          saved.pending ||
          saved.config.revision.startsWith("local-")
        )
          return;
        if (remote.revision === saved.config.revision)
          setBaseline(remote.revision);
        if (isNewerRevision(remote.revision, saved.config.revision)) {
          setBaseline(remote.revision);
          const next = saveConfig(remote);
          setState(next);
          setDraft(cloneConfig(remote));
        }
      })
      .catch(() => {});
    const storage = () => {
      try {
        setState(readStore());
      } catch (e) {
        setError((e as Error).message);
      }
    };
    const touch = () =>
      sessionStorage.setItem(sessionKey, String(Date.now() + 15 * 60000));
    const timer = setInterval(() => {
      if (Number(sessionStorage.getItem(sessionKey) || 0) < Date.now()) {
        setToken("");
        setPublishOpen(false);
        setUnlocked(false);
      }
    }, 10000);
    window.addEventListener("storage", storage);
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("storage", storage);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [unlocked]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  function saveLocal() {
    try {
      const config = {
        ...draft,
        revision: `local-${makeId()}`,
        baseRevision: baseline,
      };
      const next = saveConfig(config);
      setState(next);
      setDraft(cloneConfig(config));
      setNotice(
        "이 기기에 저장했습니다. 다른 기기에 공유하려면 GitHub에 공통 저장하세요.",
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function publish() {
    setSyncBusy(true);
    setError("");
    try {
      if (readStore().pending)
        throw new Error("진행 중인 룰렛 결과를 먼저 확인해 주세요.");
      const next = await publishConfig(draft, token, baseline);
      setBaseline(next.revision);
      setState(saveConfig(next));
      setDraft(cloneConfig(next));
      setPublishOpen(false);
      setToken("");
      setNotice(
        "GitHub에 공통 설정을 저장했습니다. 다른 기기는 새로고침 시 최신 설정을 확인하며 자동 반영에는 약 1~5분이 걸릴 수 있습니다.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }
  async function reloadRemote() {
    setSyncBusy(true);
    try {
      const config = await fetchPublishedConfig();
      if (
        config.revision !== baseline &&
        !isNewerRevision(config.revision, baseline)
      )
        throw new Error(
          "최신 설정을 확인하지 못했습니다. 잠시 후 다시 불러와 주세요.",
        );
      setState(saveConfig(config));
      setDraft(cloneConfig(config));
      setBaseline(config.revision);
      setNotice("GitHub의 최신 공통 설정을 불러왔습니다.");
      setError("");
      setReloadOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }
  const eventChange = (patch: Partial<Config["event"]>) =>
    setDraft({ ...draft, event: { ...draft.event, ...patch } });
  const displayChange = (patch: Partial<Config["display"]>) =>
    setDraft({ ...draft, display: { ...draft.display, ...patch } });
  const behaviorChange = (patch: Partial<Config["behavior"]>) =>
    setDraft({ ...draft, behavior: { ...draft.behavior, ...patch } });
  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;
  const records = state.records.filter(
    (r) => r.eventId === state.config.eventId,
  );
  const koreaDay = (date: string | Date) =>
    new Date(new Date(date).getTime() + 9 * 3600000).toISOString().slice(0, 10);
  const today = records.filter(
    (r) => koreaDay(r.time) === koreaDay(new Date()),
  ).length;
  const wins = records.filter((r) => !r.isLose).length;
  const counts = new Map<
    string,
    { name: string; color: string; count: number }
  >();
  state.config.prizes.forEach((p) =>
    counts.set(p.id, { name: p.name, color: p.color, count: 0 }),
  );
  records.forEach((r) => {
    const item = counts.get(r.prizeId) || {
      name: r.prizeName,
      color: "#7030A0",
      count: 0,
    };
    item.count++;
    counts.set(r.prizeId, item);
  });
  const maxCount = Math.max(
    1,
    ...Array.from(counts.values()).map((p) => p.count),
  );
  const preview = ["prizes", "display", "event"].includes(tab);
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Logo />
        <div className="sidebar-label">EVENT WORKSPACE</div>
        <nav>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={20} />
              {label}
              {id === "participants" && (
                <span className="nav-count">{state.records.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-info">
            <span className="status-dot" />
            <div>
              <strong>{state.config.event.name}</strong>
              <small>Exhibition workspace</small>
            </div>
          </div>
          <a
            className="button secondary full"
            href="./index.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            이벤트 화면 열기
            <ArrowUpRight size={18} />
          </a>
          <button
            className="logout"
            onClick={() => {
              sessionStorage.removeItem(sessionKey);
              setToken("");
              setUnlocked(false);
            }}
          >
            <LogOut size={17} />
            로그아웃
          </button>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-header">
          <div>
            <span className="breadcrumb">
              워크스페이스 <span>/</span>{" "}
              {tabs.find((t) => t.id === tab)?.label}
            </span>
            <h1>{tabs.find((t) => t.id === tab)?.label}</h1>
          </div>
          <div className="admin-header-right">
            <span className="saved-indicator">
              <span className={`status-dot ${dirty ? "amber" : ""}`} />
              {dirty
                ? "저장하지 않은 변경"
                : state.config.revision.startsWith("local-")
                  ? "이 기기에 저장됨"
                  : "공통 설정 적용됨"}
            </span>
            <button
              className="icon-button admin-lock"
              aria-label="관리자 잠금"
              onClick={() => {
                sessionStorage.removeItem(sessionKey);
                setToken("");
                setPublishOpen(false);
                setUnlocked(false);
              }}
            >
              <LockKeyhole size={18} />
            </button>
          </div>
        </header>
        <div className={`admin-workarea ${preview ? "with-preview" : ""}`}>
          <div className="editor-column">
            {tab === "dashboard" && (
              <>
                <div className="welcome-banner">
                  <div>
                    <span className="eyebrow">MAKE EVERY VISIT COUNT</span>
                    <h2>새로운 만남, 새로운 가능성.</h2>
                    <p>
                      {state.config.event.name}의 즐거운 순간을 함께 만들어
                      보세요.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setTab("prizes")}
                    >
                      이벤트 경품 관리 <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="banner-art">
                    <Sparkles size={80} />
                  </div>
                </div>
                <div className="stats-grid">
                  {[
                    {
                      label: "오늘 참여자",
                      value: today,
                      icon: Users,
                      foot: "한국 시간 기준",
                    },
                    {
                      label: "총 참여자",
                      value: records.length,
                      icon: Activity,
                      foot: "현재 이벤트 · 이 기기",
                    },
                    {
                      label: "총 당첨 건수",
                      value: wins,
                      icon: Trophy,
                      foot: "꽝 제외",
                    },
                  ].map(({ label, value, icon: Icon, foot }) => (
                    <div className="stat-card card" key={label}>
                      <div>
                        <span>{label}</span>
                        <Icon size={20} />
                      </div>
                      <strong>
                        {value.toLocaleString()}
                        <small>명</small>
                      </strong>
                      <p>{foot}</p>
                    </div>
                  ))}
                </div>
                <div className="dashboard-grid">
                  <section className="card chart-card">
                    <div className="card-heading">
                      <h2>상품별 당첨 현황</h2>
                      <span className="tag">현재 이벤트</span>
                    </div>
                    <div className="bar-chart">
                      {Array.from(counts.entries()).map(([id, p]) => (
                        <div className="bar-row" key={id}>
                          <span>{p.name}</span>
                          <div>
                            <i
                              style={{
                                width: `${(p.count / maxCount) * 100}%`,
                                background: "#7030A0",
                              }}
                            />
                          </div>
                          <strong>{p.count}</strong>
                        </div>
                      ))}
                    </div>
                    <p className="small muted">
                      현재 기기에서 진행한 이벤트의 기록입니다.
                    </p>
                  </section>
                  <section className="card stock-card">
                    <div className="card-heading">
                      <h2>남은 경품</h2>
                      <Gift size={20} />
                    </div>
                    {state.config.prizes
                      .filter((p) => p.active && !p.isLose)
                      .map((p) => (
                        <div className="stock-row" key={p.id}>
                          <span
                            className="color-dot"
                            style={{ background: p.color }}
                          />
                          <span>{p.name}</span>
                          <strong
                            className={
                              remaining(p, state.used) === 0
                                ? "danger-text"
                                : ""
                            }
                          >
                            {p.unlimited
                              ? "무제한"
                              : `${remaining(p, state.used)}개`}
                          </strong>
                        </div>
                      ))}
                    <button
                      className="text-button"
                      onClick={() => setTab("prizes")}
                    >
                      재고 관리하기 <ArrowRight size={16} />
                    </button>
                  </section>
                </div>
                <div className="card operation-note">
                  <div className="modal-symbol">
                    <CloudUpload size={22} />
                  </div>
                  <div>
                    <h3>설정은 함께, 기록은 이 기기에.</h3>
                    <p>
                      GitHub에 공통 저장한 설정은 모든 기기에서 불러옵니다. 참가
                      기록과 소진 재고는 각 운영 기기에 저장되므로, 행사 종료 전
                      CSV를 다운로드해 주세요.
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setTab("participants")}
                  >
                    기록 보기 <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
            {tab === "prizes" && (
              <PrizeManager
                config={draft}
                update={setDraft}
                used={state.used}
                onError={setError}
              />
            )}
            {tab === "display" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>브랜드의 분위기를 담아보세요.</h2>
                    <p>가로·세로 화면에서 자동으로 최적화됩니다.</p>
                  </div>
                </div>
                <section className="card field-card">
                  <h3>배경 스타일</h3>
                  <div className="theme-options">
                    {[
                      {
                        id: "light",
                        name: "CARIMATEC LIGHT",
                        desc: "화이트 + 퍼플",
                      },
                      {
                        id: "dark",
                        name: "CARIMATEC DARK",
                        desc: "딥 그레이 + 글로우",
                      },
                      {
                        id: "grid",
                        name: "TECH GRID",
                        desc: "정밀한 테크 그리드",
                      },
                    ].map((t) => (
                      <button
                        key={t.id}
                        className={`theme-option ${draft.display.theme === t.id ? "selected" : ""}`}
                        onClick={() =>
                          displayChange({
                            theme: t.id as Config["display"]["theme"],
                          })
                        }
                      >
                        <div className={`theme-swatch ${t.id}`}>
                          <i />
                        </div>
                        <strong>{t.name}</strong>
                        <small>{t.desc}</small>
                        {draft.display.theme === t.id && <Check size={17} />}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="card field-card">
                  <h3>룰렛 표시 요소</h3>
                  <div className="setting-options">
                    {(
                      [
                        { id: "names", label: "상품명 표시" },
                        { id: "images", label: "상품 이미지 표시" },
                        { id: "probabilities", label: "당첨 확률 표시" },
                        { id: "descriptions", label: "상품 설명 표시" },
                      ] as const
                    ).map((o) => (
                      <label className="switch-row" key={o.id}>
                        <span>{o.label}</span>
                        <input
                          type="checkbox"
                          checked={draft.display[o.id]}
                          onChange={(e) =>
                            displayChange({ [o.id]: e.target.checked })
                          }
                        />
                        <span className="switch" />
                      </label>
                    ))}
                  </div>
                  <p className="muted small">
                    확률 표시는 기본 OFF입니다. 칸 크기는 확률과 관계없이
                    동일합니다.
                  </p>
                </section>
                <section className="card field-card">
                  <div className="form-grid">
                    <label>
                      화면 배치
                      <select
                        value={draft.display.layout}
                        onChange={(e) =>
                          displayChange({
                            layout: e.target
                              .value as Config["display"]["layout"],
                          })
                        }
                      >
                        <option value="auto">자동 · 화면 방향에 맞춤</option>
                        <option value="landscape">가로 배치 우선</option>
                        <option value="portrait">세로 배치 우선</option>
                      </select>
                    </label>
                    <label>
                      회전 시간
                      <select
                        value={draft.behavior.duration}
                        onChange={(e) =>
                          behaviorChange({ duration: Number(e.target.value) })
                        }
                      >
                        <option value={4000}>4초</option>
                        <option value={5000}>5초 · 권장</option>
                        <option value={6000}>6초</option>
                      </select>
                    </label>
                  </div>
                  <p className="small muted">
                    작은 화면에서는 가독성을 위해 세로 배치로 전환됩니다. 기기의
                    모션 감소 설정이 켜져 있으면 짧은 전환을 사용합니다.
                  </p>
                </section>
              </>
            )}
            {tab === "event" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>이번 전시회를 설정해 주세요.</h2>
                    <p>제목과 안내 문구는 방문객 화면에 바로 반영됩니다.</p>
                  </div>
                </div>
                <section className="card field-card">
                  <h3>이벤트 기본 정보</h3>
                  <div className="form-grid">
                    <label className="span-two">
                      전시회명
                      <input
                        maxLength={50}
                        value={draft.event.name}
                        onChange={(e) => eventChange({ name: e.target.value })}
                      />
                    </label>
                    <label>
                      메인 제목
                      <input
                        maxLength={28}
                        value={draft.event.mainTitle}
                        onChange={(e) =>
                          eventChange({ mainTitle: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      서브 제목
                      <input
                        maxLength={28}
                        value={draft.event.subTitle}
                        onChange={(e) =>
                          eventChange({ subTitle: e.target.value })
                        }
                      />
                    </label>
                    <label className="span-two">
                      이벤트 안내 문구
                      <textarea
                        rows={3}
                        maxLength={180}
                        value={draft.event.guide}
                        onChange={(e) => eventChange({ guide: e.target.value })}
                      />
                    </label>
                    <label>
                      행사 시작일
                      <input
                        type="date"
                        value={draft.event.startDate}
                        onChange={(e) =>
                          eventChange({ startDate: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      행사 종료일
                      <input
                        type="date"
                        value={draft.event.endDate}
                        onChange={(e) =>
                          eventChange({ endDate: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={draft.event.enforceDates}
                      onChange={(e) =>
                        eventChange({ enforceDates: e.target.checked })
                      }
                    />
                    행사 기간 외 참여 제한 · 한국 시간 기준
                  </label>
                </section>
                <section className="card field-card">
                  <h3>설문 참여 및 방문객 정보</h3>
                  <p className="muted small">
                    개인정보 동의와 중복 확인은 외부 QR 설문에서 진행합니다.
                    기본 설정에서는 개인정보를 다시 입력받지 않습니다.
                  </p>
                  <label>
                    설문 주소 · 선택
                    <input
                      type="url"
                      placeholder="https://…"
                      value={draft.event.surveyUrl}
                      onChange={(e) =>
                        eventChange({ surveyUrl: e.target.value })
                      }
                    />
                  </label>
                  <label className="switch-row">
                    <span>룰렛 참여 전 방문객 정보 입력받기</span>
                    <input
                      type="checkbox"
                      checked={draft.behavior.collectCustomers}
                      onChange={(e) =>
                        behaviorChange({ collectCustomers: e.target.checked })
                      }
                    />
                    <span className="switch" />
                  </label>
                  {draft.behavior.collectCustomers && (
                    <div className="required-fields">
                      {(Object.keys(fieldLabels) as CustomerField[]).map(
                        (key) => (
                          <label className="check-label" key={key}>
                            <input
                              type="checkbox"
                              checked={draft.behavior.required[key]}
                              onChange={(e) =>
                                behaviorChange({
                                  required: {
                                    ...draft.behavior.required,
                                    [key]: e.target.checked,
                                  },
                                })
                              }
                            />
                            {fieldLabels[key]} 필수
                          </label>
                        ),
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
            {tab === "participants" && (
              <ParticipantList records={state.records} />
            )}
            {tab === "settings" && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>현장 운영을 관리하세요.</h2>
                    <p>설정 공유와 데이터 백업을 이곳에서 진행합니다.</p>
                  </div>
                </div>
                <section className="card field-card">
                  <h3>이벤트 운영</h3>
                  <label className="switch-row">
                    <span>이벤트 일시 중지</span>
                    <input
                      type="checkbox"
                      checked={draft.behavior.paused}
                      onChange={(e) =>
                        behaviorChange({ paused: e.target.checked })
                      }
                    />
                    <span className="switch" />
                  </label>
                  <label>
                    이벤트 ID
                    <input
                      maxLength={100}
                      value={draft.eventId}
                      onChange={(e) =>
                        setDraft({ ...draft, eventId: e.target.value })
                      }
                    />
                  </label>
                  <p className="muted small">
                    다음 전시회에는 새 ID를 사용하세요. ID 변경 시 현장 소진
                    수량이 초기화되고 기존 참여 기록은 유지됩니다.
                  </p>
                </section>
                <section className="card field-card">
                  <h3>GitHub 공통 설정</h3>
                  <p className="repo-label">
                    {REPOSITORY.owner} / {REPOSITORY.name}
                  </p>
                  <p className="muted">
                    상품, 이미지, 초기 수량, 디자인, 행사 정보를 GitHub에
                    저장합니다. 공개 저장소이므로 참가자 정보와 인증 정보는
                    포함하지 않습니다.
                  </p>
                  <div className="settings-actions">
                    <button
                      className="button primary"
                      disabled={!!errors.length || syncBusy}
                      onClick={() => setPublishOpen(true)}
                    >
                      <CloudUpload size={18} />
                      GitHub에 공통 저장
                    </button>
                    <button
                      className="button secondary"
                      disabled={syncBusy}
                      onClick={() => setReloadOpen(true)}
                    >
                      <RefreshCw size={18} />
                      최신 설정 불러오기
                    </button>
                  </div>
                  <p className="small muted">
                    다른 기기에서 설정을 불러오려면 인터넷 연결이 필요합니다. 이
                    기기에만 저장한 설정은 공통 설정으로 덮어쓰지 않습니다.
                  </p>
                </section>
                <section className="card field-card">
                  <h3>백업 및 복원</h3>
                  <div className="settings-actions">
                    <button
                      className="button secondary"
                      disabled={!!errors.length}
                      onClick={() =>
                        downloadFile(
                          JSON.stringify(publicSettings(draft), null, 2),
                          "event.json",
                          "application/json",
                        )
                      }
                    >
                      <Download size={18} />
                      설정 JSON 내보내기
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => importRef.current?.click()}
                    >
                      <Upload size={18} />
                      설정 JSON 가져오기
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        downloadFile(
                          JSON.stringify(state, null, 2),
                          `carimatec-backup-${Date.now()}.json`,
                          "application/json",
                        )
                      }
                    >
                      <Download size={18} />
                      기기 전체 백업
                    </button>
                  </div>
                  <p className="small muted">
                    설정 JSON은 새 게시 버전이 포함된 event.json으로 저장됩니다.
                    GitHub의 public/data/event.json과 docs/data/event.json을
                    같은 내용으로 교체하고 커밋하세요. 배포 후 운영 기기에서
                    최신 공통 설정을 불러오세요. 기기 전체 백업은 GitHub에
                    올리지 마세요.
                  </p>
                  <input
                    hidden
                    ref={importRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        if (file.size > 2000000)
                          throw new Error(
                            "설정 파일은 2MB 이하로 선택해 주세요.",
                          );
                        const value: unknown = JSON.parse(await file.text());
                        assertConfig(value);
                        setDraft(cloneConfig(value));
                        setNotice(
                          "설정을 가져왔습니다. 내용을 확인하고 저장해 주세요.",
                        );
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  />
                  <p className="small muted">
                    설정 가져오기는 미리보기에만 적용됩니다. 전체 백업에는 참여
                    기록이 포함되므로 안전한 장소에 보관하세요.
                  </p>
                </section>
                <section className="card field-card danger-zone">
                  <h3>데이터 초기화</h3>
                  <p className="muted small">
                    이 기기의 참여 기록과 소진 수량만 함께 초기화합니다. 잔여
                    수량은 각 상품에 설정된 초기 수량으로 복구되며, 상품
                    목록·이미지·확률·이벤트 설정과 GitHub 공통 설정은 변경하지
                    않습니다.
                  </p>
                  <div className="settings-actions">
                    <button
                      className="button danger-outline"
                      disabled={!!state.pending}
                      onClick={() => setResetOpen(true)}
                    >
                      참여 기록·상품 수량 초기화
                    </button>
                  </div>
                  {state.pending && (
                    <p className="small muted">
                      진행 중인 룰렛 결과를 확인한 뒤 초기화할 수 있습니다.
                    </p>
                  )}
                </section>
                <p className="small muted">
                  관리자 PIN은 현장 접근 방지용입니다. 정적 페이지의 실제 보안
                  인증이 아니며, 15분 미사용 시 잠금 화면으로 돌아갑니다.
                </p>
              </>
            )}
          </div>
          {preview && (
            <aside className="preview-column">
              <div className="preview-card card">
                <div className="card-heading">
                  <h3>Roulette Preview</h3>
                  <span className="tag purple">
                    <span className="status-dot" />
                    LIVE
                  </span>
                </div>
                <div className={`preview-canvas theme-${draft.display.theme}`}>
                  <Logo inverse={draft.display.theme === "dark"} />
                  <span className="eyebrow">{draft.event.name}</span>
                  <h3>
                    {draft.event.mainTitle}
                    <br />
                    <span>{draft.event.subTitle}</span>
                  </h3>
                  <RouletteWheel
                    prizes={draft.prizes.filter((p) => p.active)}
                    display={draft.display}
                  />
                  <div className="preview-button">
                    룰렛 돌리기 <ArrowRight size={16} />
                  </div>
                </div>
                <div className="preview-footer">
                  <Eye size={16} />
                  <span>저장 전 디자인 미리보기</span>
                </div>
              </div>
              <div className="preview-tip">
                <Sparkles size={18} />
                <p>
                  룰렛의 칸 크기는 모두 동일합니다.
                  <br />
                  실제 당첨은 설정한 확률을 따릅니다.
                </p>
              </div>
            </aside>
          )}
        </div>
        {errors.length > 0 && (
          <div className="validation-banner" role="alert">
            {errors.join(" ")}
          </div>
        )}
        <div className="save-bar">
          <span>
            {dirty
              ? "변경사항을 저장해 주세요."
              : "모든 변경사항이 저장되어 있습니다."}
          </span>
          <div>
            <button
              className="button secondary"
              disabled={!!errors.length || syncBusy || !dirty}
              onClick={saveLocal}
            >
              <Save size={18} />이 기기에 저장
            </button>
            <button
              className="button primary"
              disabled={!!errors.length || syncBusy}
              onClick={() => setPublishOpen(true)}
            >
              <CloudUpload size={18} />
              공통 설정 저장
            </button>
          </div>
        </div>
      </div>
      {(notice || error) && (
        <div
          className={`toast ${error ? "error" : "success"}`}
          role={error ? "alert" : "status"}
        >
          {error || notice}
          <button
            aria-label="알림 닫기"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {publishOpen && (
        <Modal
          title="GitHub 공통 설정 저장"
          onClose={
            syncBusy
              ? undefined
              : () => {
                  setPublishOpen(false);
                  setToken("");
                }
          }
        >
          <div className="modal-symbol">
            <CloudUpload size={30} />
          </div>
          <h2>모든 기기에 설정 공유</h2>
          <p>아래 저장소의 설정 파일에 변경사항을 저장합니다.</p>
          <p className="repo-label">
            {REPOSITORY.owner}/{REPOSITORY.name}
          </p>
          <label>
            GitHub Fine-grained Token
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="github_pat_…"
            />
          </label>
          <p className="muted small">
            이 저장소만 선택하고 Contents: Read and write 권한을 부여한 토큰을
            사용하세요. 토큰은 브라우저 메모리에서만 사용하고 저장 후 지웁니다.
          </p>
          <a
            className="survey-link"
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub에서 토큰 만들기 <ArrowUpRight size={16} />
          </a>
          <button
            className="button primary full"
            disabled={!token.trim() || syncBusy || !!errors.length}
            onClick={() => void publish()}
          >
            {syncBusy ? "GitHub에 저장 중…" : "변경사항 공통 저장"}
            <CloudUpload size={18} />
          </button>
        </Modal>
      )}
      {reloadOpen && (
        <Modal
          title="최신 설정 불러오기"
          onClose={syncBusy ? undefined : () => setReloadOpen(false)}
        >
          <h2>공통 설정을 불러올까요?</h2>
          <p>
            현재 편집 중이거나 이 기기에만 저장한 설정을 GitHub 최신 설정으로
            교체합니다. 참가 기록과 소진 재고는 유지됩니다.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={syncBusy}
              onClick={() => setReloadOpen(false)}
            >
              취소
            </button>
            <button
              className="button primary"
              disabled={syncBusy}
              onClick={() => void reloadRemote()}
            >
              {syncBusy ? "불러오는 중…" : "불러오기"}
            </button>
          </div>
        </Modal>
      )}
      {resetOpen && (
        <Modal title="데이터 초기화 확인" onClose={() => setResetOpen(false)}>
          <h2>참여 기록과 상품 수량을 초기화할까요?</h2>
          <p>
            이 기기의 모든 참여 기록 {state.records.length}건을 삭제하고, 소진
            수량을 0으로 되돌립니다. 잔여 수량은 각 상품에 설정된 초기 수량으로
            복구됩니다.
          </p>
          <p>
            상품 목록·이미지·확률·이벤트 설정은 그대로 유지됩니다. GitHub 공통
            설정과 다른 기기의 기록·수량은 변경하지 않습니다. 삭제한 기록은 이
            화면에서 복구할 수 없으므로 CSV 또는 기기 전체 백업을 먼저
            보관하세요.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setResetOpen(false)}
            >
              취소
            </button>
            <button
              className="button danger"
              onClick={() => {
                try {
                  const next = resetData();
                  setState(next);
                  setResetOpen(false);
                  setError("");
                  setNotice(
                    "참여 기록과 상품 소진 수량을 초기화했습니다. 상품 및 이벤트 설정은 유지됩니다.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              초기화
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
