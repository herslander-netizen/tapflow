// TapFlow agents: capabilities are declarative, not authorizations to mutate.
export const AGENTS=Object.freeze({
 catalogo:Object.freeze({label:"Cardápio",roles:["owner","manager"],capabilities:["draft:menu-description"]}),
 atendimento:Object.freeze({label:"Atendimento",roles:["owner","manager","staff"],capabilities:["read:approved-faq","draft:reply"]}),
 conteudo:Object.freeze({label:"Conteúdo Reels",roles:["owner","manager"],capabilities:["draft:video-script"]}),
 gestao:Object.freeze({label:"Gestão",roles:["owner","manager"],capabilities:["read:aggregate-metrics","draft:summary"]}),
 notificacoes:Object.freeze({label:"Avisos Evolution",roles:["owner","manager","staff"],capabilities:["draft:whatsapp-notification"]})
});
export const FORBIDDEN=Object.freeze(["send:message","write:order","write:price","charge:payment","refund:payment","publish:menu","read:customer-data"]);
export function listAgentCapabilities(role){
 return Object.entries(AGENTS).filter(([,a])=>a.roles.includes(role)).map(([id,a])=>({id,label:a.label,capabilities:[...a.capabilities]}));
}
