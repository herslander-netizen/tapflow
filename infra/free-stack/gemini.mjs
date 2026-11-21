/**
 * TapFlow / Gemini — adapter SERVER-ONLY.
 * No public route. Do not expose API keys or use without admin authentication.
 */
const GEMINI_URL="https://generativelanguage.googleapis.com/v1beta/models/";
const DEFAULT_MODEL="gemini-3.5-flash-lite";
const CLEAN_TEXT=/[<>\u0000-\u001F]/g;

export function normalizeProductDraft(input){
  if(!input||typeof input!=="object")throw new TypeError("Produto inválido");
  const name=String(input.name||"").trim().replace(CLEAN_TEXT,"").slice(0,80);
  const category=String(input.category||"").trim().replace(CLEAN_TEXT,"").slice(0,60);
  const ingredients=String(input.ingredients||"").trim().replace(CLEAN_TEXT,"").slice(0,400);
  if(name.length<2||name.length>80)throw new RangeError("Nome do produto inválido");
  if(category.length>60||ingredients.length<3)throw new RangeError("Informações insuficientes");
  return {name,category,ingredients};
}

export async function suggestProductDescription(input,{env,fetcher=fetch}={}){
  if(!env||env.GEMINI_ENABLED!=="true"||env.GEMINI_FREE_TIER_CONFIRMED!=="true")
    throw new Error("Integração Gemini desativada: Free Tier não confirmado");
  if(typeof env.GEMINI_API_KEY!=="string"||env.GEMINI_API_KEY.length<20)
    throw new Error("Secret GEMINI_API_KEY não configurado no servidor");

  const model=String(env.GEMINI_MODEL||DEFAULT_MODEL);
  if(!/^gemini-[a-z0-9.-]{3,48}$/.test(model))throw new Error("Modelo Gemini não permitido");
  const draft=normalizeProductDraft(input);
  const prompt=[
    "Você auxilia o cadastro de cardápios do TapFlow. Responda SOMENTE com uma descrição comercial",
    "em português do Brasil, objetiva e com até 180 caracteres. Use apenas ingredientes",
    "explicitamente fornecidos. Não invente alergênicos, pesos, preços, preparo,",
    "certificações, promessas de saúde ou disponibilidade. Revisão humana obrigatória.",
    "Nome: "+draft.name,
    "Categoria: "+draft.category,
    "Ingredientes informados: "+draft.ingredients
  ].join("\n");

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetcher(GEMINI_URL+encodeURIComponent(model)+":generateContent",{
      method:"POST",
      headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
      body:JSON.stringify({
        contents:[{role:"user",parts:[{text:prompt}]}],
        generationConfig:{temperature:0.35,maxOutputTokens:128,responseMimeType:"text/plain"}
      }),
      signal:controller.signal
    });
    if(!response.ok)throw new Error("Serviço de IA indisponível ("+response.status+")");
    const data=await response.json();
    const text=data?.candidates?.[0]?.content?.parts?.filter(p=>typeof p.text==="string").map(p=>p.text).join(" ").trim()||"";
    if(!text)throw new Error("A IA não retornou uma descrição");
    const description=text.replace(CLEAN_TEXT,"").slice(0,180);
    return {description,source:"gemini",model,reviewRequired:true,published:false};
  }finally{
    clearTimeout(timeout);
  }
}
