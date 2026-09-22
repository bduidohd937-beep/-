export type CrosshairStyle = "classic" | "dot" | "small" | "gap" | "box" | "pro" | "custom";
export type CrosshairConfig = { style: CrosshairStyle; color: string; size: number; gap: number; thickness: number; outline: boolean; centerDot: boolean };
export const DEFAULT_CROSSHAIR: CrosshairConfig = { style: "classic", color: "#ffffff", size: 12, gap: 4, thickness: 2, outline: true, centerDot: false };
export const CROSSHAIR_PRESETS: Record<string, CrosshairConfig> = {
  "클래식 십자": DEFAULT_CROSSHAIR,
  "점형": { ...DEFAULT_CROSSHAIR, style: "dot", size: 5, gap: 0, thickness: 3, outline: true, centerDot: true },
  "작은 십자": { ...DEFAULT_CROSSHAIR, style: "small", size: 8, gap: 3, thickness: 2, outline: true },
  "넓은 십자": { ...DEFAULT_CROSSHAIR, style: "gap", size: 13, gap: 7, thickness: 2, outline: true },
  "박스형": { ...DEFAULT_CROSSHAIR, style: "box", size: 12, gap: 4, thickness: 2, outline: true },
  "컴페티티브": { ...DEFAULT_CROSSHAIR, style: "pro", size: 10, gap: 3, thickness: 2, outline: true, centerDot: true },
};
export function loadCrosshair(): CrosshairConfig {
  try { return { ...DEFAULT_CROSSHAIR, ...JSON.parse(localStorage.getItem("sanghyeon-crosshair") || "null") }; } catch { return DEFAULT_CROSSHAIR; }
}
export function saveCrosshair(c: CrosshairConfig) { localStorage.setItem("sanghyeon-crosshair", JSON.stringify(c)); }

export function parseValorantCrosshairCode(code:string): CrosshairConfig | null {
  const raw=code.trim();
  if(!raw) return null;
  const parts=raw.split(';').map(x=>x.trim()).filter(Boolean);
  const map=new Map<string,string>();
  for(let i=0;i+1<parts.length;i+=2){
    const k=parts[i],v=parts[i+1];
    if(k==='0'||k==='P') continue;
    map.set(k,v);
  }
  // Riot's share strings use u;HEX for custom color. Other fields use 0t/0l/0v etc.
  const hex=map.get('u');
  const color=hex && /^[0-9a-fA-F]{8}$/.test(hex) ? `#${hex.slice(0,6)}` : DEFAULT_CROSSHAIR.color;
  const num=(k:string,f:number)=>{const n=Number(map.get(k));return Number.isFinite(n)?n:f};
  const outline=num('o',DEFAULT_CROSSHAIR.outline?1:0)>0;
  const centerDot=num('f',DEFAULT_CROSSHAIR.centerDot?1:0)>0;
  const thickness=Math.max(1,Math.min(4,Math.round(num('0t',DEFAULT_CROSSHAIR.thickness))));
  const length=Math.max(1,Math.min(18,Math.round(num('0l',DEFAULT_CROSSHAIR.size))));
  const gap=Math.max(0,Math.min(10,Math.round(num('0v',DEFAULT_CROSSHAIR.gap))));
  return {...DEFAULT_CROSSHAIR,style:centerDot&&length<=5?'dot':'classic',color,size:length,gap,thickness,outline,centerDot};
}
