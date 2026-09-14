import { useState } from "react";
export function Logo({ inverse = false }: { inverse?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`logo ${inverse ? "inverse" : ""}`}>
      {failed ? (
        <span>CARIMATEC</span>
      ) : (
        <img
          src={`${import.meta.env.BASE_URL}assets/logo.png`}
          alt="CARIMATEC"
          onError={() => setFailed(true)}
          draggable={false}
        />
      )}
    </div>
  );
}
