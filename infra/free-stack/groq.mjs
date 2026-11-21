/**
 * GroqCloud adapter: server-side use only, no public AI endpoint.
 * Requires explicit Free Tier confirmation and a secret stored in the environment.
 */
import {normalizeProductDraft} from "./gemini.mjs";
const URL="https://api.groq.com/openai/v1/chat/completions";
export async function suggestProductDescriptionGroq(input,{env,fetcher=fetch}={}){
  if(!env||env.GROQ_ENABLED!=="true"||env.GROQ_FREE_TIER_CONFIRMED!=="true")
    throw new Error("Groq desativado: Free Tier não confirmado");
  if(typeof env.GROQ_API_KEY!=="string"||env.GROQ_API_KEY.length<20)
    throw new Error("Secret GROQ_API_KEY não configurado no servidor");
  const model=env.GROQ_MODEL;
  if(typeof model!=="string"||!/^[-_a-zA-Z0-9./]{3,90}$/.test(model))
    throw new Error("Configure um modelo Groq permitido no ambiente");
  const product=normalizeProductDraft(input);
  const prompt="Crie apenas uma descrição comercial em português brasileiro, até 180 caracteres. Use SOMENTE os ingredientes informados, não invente alergênicos, peso, preço ou propriedades nutricionais. Revisão humana obrigatória.\n"+
    "Nome: "+product.name+"\nCategoria: "+product.category+"\nIngredientes: "+product.ingredients;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetcher(URL,{
      method:"POST",
      headers:{"authorization":"Bearer "+env.GROQ_API_KEY,"content-type":"application/json"},
      body:JSON.stringify({model,temperature:0.35,max_tokens:128,messages:[{role:"system",content:"Você ajuda a cadastrar descrições de cardápio. Não invente informações."},{role:"user",content:prompt}]}),
      signal:controller.signal
    });
    if(!response.ok)throw new Error("Serviço de IA indisponível ("+response.status+")");
    const data=await response.json();
    const content=data?.choices?.[0]?.message?.content;
    if(typeof content!=="string"||!content.trim())throw new Error("A IA não retornou uma descrição");
    return {description:content.trim().replace(/[<>\x00-\x1f]/g,"").slice(0,180),source:"groq",model,reviewRequired:true,published:false};
  }finally{clearTimeout(timeout);}
}
