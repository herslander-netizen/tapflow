/**
 * Decision helpers for mobile navigation.
 * Pure logic: no DOM, no timers, no third-party dependency.
 */
export function swipeDirection({dx,dy,fromInteractive=false,threshold=64}={}){
 if(fromInteractive||!Number.isFinite(dx)||!Number.isFinite(dy)||threshold<24)return 0;
 if(Math.abs(dy)<threshold||Math.abs(dy)<=Math.abs(dx)*1.25)return 0;
 return dy<0?1:-1;
}
export function actionIsInteractive(target){
 return Boolean(target?.closest?.("button,a[href],input,textarea,select,label,[role=button],[contenteditable]"));
}
