import { forwardRef } from "react";
import type { Config, Prize } from "../types";
export function assetUrl(path: string) {
  return path.startsWith("assets/")
    ? `${import.meta.env.BASE_URL}${path}`
    : path;
}
function foreground(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((v) => parseInt(v, 16)) || [255, 255, 255];
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 156
    ? "#ffffff"
    : "#342043";
}
function splitLabel(value: string, count: number) {
  const max = count >= 10 ? 4 : count >= 7 ? 5 : count === 6 ? 6 : 9;
  const characters = Array.from(value);
  if (characters.length <= max) return [value];
  return [
    characters.slice(0, max).join(""),
    characters.slice(max, max * 2 - 1).join("") +
      (characters.length > max * 2 - 1 ? "…" : ""),
  ];
}
type Props = {
  prizes: Prize[];
  display: Config["display"];
  rotation?: number;
  spinning?: boolean;
  probabilities?: Record<string, number>;
  pointerRef?: React.Ref<HTMLDivElement>;
};
export const RouletteWheel = forwardRef<SVGSVGElement, Props>(
  function RouletteWheel(
    { prizes, display, rotation = 0, spinning, probabilities, pointerRef },
    ref,
  ) {
    const count = prizes.length;
    const step = 360 / Math.max(1, count);
    const r = 228;
    return (
      <div
        className={`wheel-wrap ${spinning ? "spinning" : ""}`}
        aria-label="경품 룰렛"
      >
        <div className="wheel-orbit orbit-one" />
        <div className="wheel-orbit orbit-two" />
        <div className="orbit-dot" />
        <div className="wheel-pointer" ref={pointerRef} aria-hidden="true">
          <div />
        </div>
        <div className="wheel-bezel">
          <svg
            ref={ref}
            className="wheel-svg"
            viewBox="0 0 480 480"
            style={{ transform: `rotate(${rotation}deg)` }}
            role="img"
            aria-label={`룰렛 상품: ${prizes.map((p) => p.label).join(", ")}`}
          >
            {prizes.map((p, i) => {
              const start = (i * step * Math.PI) / 180,
                end = ((i + 1) * step * Math.PI) / 180;
              const x1 = 240 + r * Math.sin(start),
                y1 = 240 - r * Math.cos(start),
                x2 = 240 + r * Math.sin(end),
                y2 = 240 - r * Math.cos(end);
              const lines = splitLabel(p.label, count);
              const text = foreground(p.color);
              return (
                <g key={p.id} data-prize-id={p.id}>
                  <path
                    d={`M240 240 L${x1} ${y1} A${r} ${r} 0 ${step > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth="1.8"
                  />
                  <g transform={`rotate(${(i + 0.5) * step} 240 240)`}>
                    {display.images && (
                      <g>
                        {p.image ? (
                          <image
                            href={assetUrl(p.image)}
                            x={count > 8 ? 220 : 213}
                            y="63"
                            width={count > 8 ? 40 : 54}
                            height={count > 8 ? 40 : 54}
                            preserveAspectRatio="xMidYMid meet"
                          />
                        ) : (
                          <text
                            x="240"
                            y="96"
                            textAnchor="middle"
                            fill={text}
                            fontSize="30"
                          >
                            ✧
                          </text>
                        )}
                      </g>
                    )}
                    {display.names && (
                      <text
                        x="240"
                        y={display.images ? 131 : 110}
                        textAnchor="middle"
                        fill={text}
                        fontSize={count >= 7 ? 11 : 15}
                        fontWeight="700"
                      >
                        {lines.map((line, j) => (
                          <tspan key={j} x="240" dy={j === 0 ? 0 : 17}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                    )}
                    {display.probabilities && (
                      <text
                        x="240"
                        y={display.images ? 165 : 153}
                        textAnchor="middle"
                        fill={text}
                        fontSize={count > 8 ? 9 : 11}
                      >
                        {(probabilities?.[p.id] ?? p.weight).toFixed(1)}%
                      </text>
                    )}
                    {display.descriptions && (
                      <text
                        x="240"
                        y={display.images ? 180 : 174}
                        textAnchor="middle"
                        fill={text}
                        fontSize="8"
                      >
                        {p.description.slice(0, count > 8 ? 4 : 8)}
                        {p.description.length > (count > 8 ? 4 : 8) ? "…" : ""}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </svg>
          <div className="wheel-hub">
            {/* Show only the original logo's right-hand symbol, without altering the artwork. */}
            <svg
              className="hub-symbol"
              viewBox="650 0 147 166"
              role="img"
              aria-label="캐리마텍 심볼"
              focusable="false"
            >
              <image
                href={assetUrl("assets/logo.png")}
                x="0"
                y="0"
                width="797"
                height="166"
              />
            </svg>
          </div>
        </div>
        <div className="wheel-shadow" />
      </div>
    );
  },
);
