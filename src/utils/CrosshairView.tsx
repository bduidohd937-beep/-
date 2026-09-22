import type { CSSProperties } from "react";
import type { CrosshairConfig } from "./crosshair";

/**
 * SVG 기반 조준선. 기존 pseudo-element CSS에 의존하지 않아
 * 프리셋을 바꿨을 때 게임 화면에도 동일하게 적용된다.
 */
export default function CrosshairView({ config, style, className = "" }: {
  config: CrosshairConfig;
  style?: CSSProperties;
  className?: string;
}) {
  const s = Math.max(4, config.size);
  const gap = Math.max(0, config.gap);
  const t = Math.max(1, config.thickness);
  const outer = config.outline ? 2 : 0;
  const half = s / 2;
  const canvas = Math.max(48, s * 3 + gap * 3);
  const c = canvas / 2;
  const inner = gap + t / 2;
  const end = inner + s;
  const dot = config.centerDot;
  const common = {
    stroke: config.color,
    strokeWidth: t,
    strokeLinecap: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  const outlineCommon = {
    ...common,
    stroke: "#000",
    strokeWidth: t + outer * 2,
  };

  const line = (x1:number,y1:number,x2:number,y2:number,key:string) => (
    <g key={key}>
      {outer > 0 && <line x1={x1} y1={y1} x2={x2} y2={y2} {...outlineCommon} />}
      <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />
    </g>
  );

  return (
    <svg
      className={`aim-crosshair-svg ${className}`}
      style={style}
      width={canvas}
      height={canvas}
      viewBox={`0 0 ${canvas} ${canvas}`}
      aria-hidden="true"
    >
      {config.style === "dot" ? (
        <>
          {outer > 0 && <circle cx={c} cy={c} r={half + outer} fill="#000" />}
          <circle cx={c} cy={c} r={half} fill={config.color} />
        </>
      ) : config.style === "box" ? (
        <>
          {outer > 0 && <rect x={c-s-gap} y={c-s-gap} width={(s+gap)*2} height={(s+gap)*2} fill="none" stroke="#000" strokeWidth={t+outer*2} />}
          <rect x={c-s-gap} y={c-s-gap} width={(s+gap)*2} height={(s+gap)*2} fill="none" stroke={config.color} strokeWidth={t} />
        </>
      ) : (
        <>
          {line(c+inner, c, c+end, c, "r")}
          {line(c-inner, c, c-end, c, "l")}
          {line(c, c-inner, c, c-end, "u")}
          {line(c, c+inner, c, c+end, "d")}
          {config.style === "small" && <circle cx={c} cy={c} r={Math.max(1, t/2)} fill={config.color} />}
        </>
      )}
      {dot && (
        <>
          {outer > 0 && <circle cx={c} cy={c} r={t/2 + outer} fill="#000" />}
          <circle cx={c} cy={c} r={Math.max(1, t/2)} fill={config.color} />
        </>
      )}
    </svg>
  );
}
