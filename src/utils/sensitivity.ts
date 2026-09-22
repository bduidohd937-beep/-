export type SensitivityConfig={dpi:number;sens:number};
export const DEFAULT_SENSITIVITY:SensitivityConfig={dpi:800,sens:0.4};
const KEY='sanghyeon-sensitivity-v4';
export function loadSensitivity():SensitivityConfig{try{return {...DEFAULT_SENSITIVITY,...JSON.parse(localStorage.getItem(KEY)||'null')}}catch{return DEFAULT_SENSITIVITY}}
export function saveSensitivity(v:SensitivityConfig){localStorage.setItem(KEY,JSON.stringify(v))}
export function getEDPI(v:SensitivityConfig){return v.dpi*v.sens}
export function cm360(v:SensitivityConfig){const edpi=getEDPI(v);return edpi>0?360*2.54/(edpi*0.07):0}
export function getTrainingScale(v:SensitivityConfig){return Math.max(.35,Math.min(2.2,getEDPI(v)/320))}
