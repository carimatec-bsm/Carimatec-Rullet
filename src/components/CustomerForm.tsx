import { useState } from "react";
import { ArrowRight, Check, ClipboardCheck } from "lucide-react";
import { Modal } from "./Modal";
import { emptyCustomer } from "../data/defaultConfig";
import type { Config, Customer, CustomerField } from "../types";
export const fieldLabels: Record<CustomerField, string> = {
  name: "성함",
  company: "회사명",
  phone: "연락처",
  email: "이메일",
};
export function CustomerForm({
  config,
  onSubmit,
  onClose,
  busy,
}: {
  config: Config;
  onSubmit: (customer: Customer) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const [customer, setCustomer] = useState<Customer>({ ...emptyCustomer });
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal
      title="룰렛 참여 확인"
      onClose={busy ? undefined : onClose}
      className="participation-modal"
    >
      <div className="modal-symbol">
        <ClipboardCheck size={30} />
      </div>
      <span className="eyebrow">ONE MORE STEP</span>
      <h2>
        행운을 만나기 전,
        <br />
        참여를 확인해 주세요.
      </h2>
      <p className="muted">
        현장 QR 설문을 완료하셨나요?
        <br />
        설문 참여 후 룰렛을 한 번 돌릴 수 있어요.
      </p>
      {config.event.surveyUrl && (
        <a
          className="survey-link"
          href={config.event.surveyUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          설문 페이지 열기 <ArrowRight size={16} />
        </a>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (confirmed && !busy) onSubmit(customer);
        }}
      >
        {config.behavior.collectCustomers && (
          <div className="customer-fields">
            {(Object.keys(fieldLabels) as CustomerField[]).map((key) => (
              <label key={key}>
                {fieldLabels[key]}
                {config.behavior.required[key] && (
                  <b className="required"> *</b>
                )}
                <input
                  name={key}
                  value={customer[key]}
                  onChange={(e) =>
                    setCustomer({ ...customer, [key]: e.target.value })
                  }
                  required={config.behavior.required[key]}
                  maxLength={key === "email" ? 120 : 60}
                  type={
                    key === "email" ? "email" : key === "phone" ? "tel" : "text"
                  }
                  autoComplete="off"
                  placeholder={
                    key === "phone"
                      ? "010-0000-0000"
                      : `${fieldLabels[key]} 입력`
                  }
                  pattern={key === "phone" ? "[0-9+()\\- .]{7,25}" : undefined}
                />
              </label>
            ))}
          </div>
        )}
        <label className={`participation-check ${confirmed ? "checked" : ""}`}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span className="custom-check">
            <Check size={18} />
          </span>
          <span>QR 설문 참여를 완료했습니다.</span>
        </label>
        <button
          className="button primary full"
          disabled={!confirmed || busy}
          type="submit"
        >
          {busy ? "참여 준비 중…" : "확인하고 룰렛 돌리기"}
          <ArrowRight size={21} />
        </button>
      </form>
    </Modal>
  );
}
