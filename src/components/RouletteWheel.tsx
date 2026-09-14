import { forwardRef } from "react";
import type { Config, Prize } from "../types";
import {
  prizeLayout,
  splitPrizeLabel,
  WHEEL_HUB_SIZE_RATIO,
} from "../utils/wheelLayout";
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
              const lines = display.names
                ? splitPrizeLabel(p.label, count)
                : [];
              const rows = [
                ...lines,
                ...(display.probabilities
                  ? [`${(probabilities?.[p.id] ?? p.weight).toFixed(1)}%`]
                  : []),
                ...(display.descriptions
                  ? [splitPrizeLabel(p.description, count)[0]]
                  : []),
              ];
              const layout = prizeLayout(count, i, rows, display.images);
              const text = foreground(p.color);
              return (
                <g key={p.id} data-prize-id={p.id}>
                  <path
                    d={`M240 240 L${x1} ${y1} A${r} ${r} 0 ${step > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth="1.8"
                  />
                  {display.images && (
                    <g
                      transform={`translate(${layout.imageX} ${layout.imageY})`}
                    >
                      <g
                        data-wheel-upright="true"
                        transform={`rotate(${-rotation})`}
                      >
                        {p.image ? (
                          <image
                            className="prize-wheel-image"
                            href={assetUrl(p.image)}
                            x={-layout.imageSize / 2}
                            y={-layout.imageSize / 2}
                            width={layout.imageSize}
                            height={layout.imageSize}
                            preserveAspectRatio="xMidYMid meet"
                          />
                        ) : (
                          <text
                            x="0"
                            y={layout.imageSize * 0.15}
                            textAnchor="middle"
                            fill={text}
                            fontSize={layout.imageSize * 0.65}
                          >
                            ✧
                          </text>
                        )}
                      </g>
                    </g>
                  )}
                  <g
                    transform={`translate(240 240) rotate(${layout.angle}) translate(0 ${-layout.textRadius})`}
                  >
                    <g
                      className="prize-wheel-label"
                      transform={
                        layout.angle > 90 && layout.angle < 270
                          ? "rotate(180)"
                          : undefined
                      }
                    >
                      {rows.map((line, j) => (
                        <text
                          key={j}
                          x="0"
                          y={
                            -layout.textHeight / 2 +
                            layout.lineHeight * (j + 0.82)
                          }
                          textAnchor="middle"
                          fill={text}
                          fontSize={layout.fontSize}
                          fontWeight={j < lines.length ? "700" : "400"}
                        >
                          {line}
                        </text>
                      ))}
                    </g>
                  </g>
                </g>
              );
            })}
          </svg>
          <div
            className="wheel-hub"
            style={{
              width: `${WHEEL_HUB_SIZE_RATIO * 100}%`,
              height: `${WHEEL_HUB_SIZE_RATIO * 100}%`,
            }}
          >
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
