import { DEFAULT_SETTINGS, THEME_PRESETS, isHex, normalizeSettings } from "../web/theme.mjs";

const ID=/^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY=1024;
const MAX_REVISION=Number.MAX_SAFE_INTEGER-1;
// Tenant-wide publishing cannot be authorized by a single branch manager (or owner
// of just one branch). Authorization is in the same statement as every mutation.
const OWNER=`WITH scope(tenant_id,issuer,subject) AS (VALUES(?1,?2,?3)),
  authority AS (
    SELECT t.id, MIN(s.staff_id) AS staff_id
    FROM scope q
    JOIN tenants t ON t.id=q.tenant_id AND t.status='active'
    JOIN merchant_owners o ON o.tenant_id=t.id AND o.issuer=q.issuer
      AND o.subject=q.subject AND o.status='active'
    JOIN locations l ON l.tenant_id=t.id AND l.status='active'
    LEFT JOIN order_staff_memberships s ON s.tenant_id=t.id AND s.location_id=l.id
      AND s.issuer=q.issuer AND s.subject=q.subject
      AND s.role='owner' AND s.status='active' AND s.staff_id=o.staff_id
    GROUP BY t.id HAVING COUNT(l.id)=COUNT(s.staff_id)
  )`;
const SELECT=`${OWNER} SELECT a.draft_json,a.published_json,a.revision
  FROM authority u LEFT JOIN tenant_appearances a ON a.tenant_id=u.id AND a.location_id=''`;
const INSERT=`${OWNER} INSERT INTO tenant_appearances(tenant_id,location_id,draft_json,updated_by)
  SELECT id,'',?4,staff_id FROM authority WHERE true
  ON CONFLICT(tenant_id,location_id) DO NOTHING
  RETURNING draft_json,published_json,revision`;
const UPDATE=`${OWNER} UPDATE tenant_appearances SET draft_json=?4,
  revision=revision+1,updated_by=(SELECT staff_id FROM authority),updated_at=CURRENT_TIMESTAMP
  WHERE tenant_id=(SELECT id FROM authority) AND location_id='' AND revision=?5
  RETURNING draft_json,published_json,revision`;
const PUBLISH=`${OWNER} UPDATE tenant_appearances SET published_json=draft_json,
  revision=revision+1,updated_by=(SELECT staff_id FROM authority),
  updated_at=CURRENT_TIMESTAMP,published_at=CURRENT_TIMESTAMP
  WHERE tenant_id=(SELECT id FROM authority) AND location_id='' AND revision=?4 AND draft_json=?5
  RETURNING draft_json,published_json,revision`;
const reply=(value,status)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
const fail=(status,error)=>reply({error},status);
const object=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const fields=(o,names)=>object(o)&&Object.keys(o).length===names.length&&names.every(n=>Object.hasOwn(o,n));

function settings(v){
  if(!fields(v,["preset","mode","accent","background"])||typeof v.preset!=="string"||
    !Object.hasOwn(THEME_PRESETS,v.preset)||!["light","dark"].includes(v.mode)||
    !(v.accent===null||isHex(v.accent))||!(v.background===null||isHex(v.background)))return null;
  return normalizeSettings(v);
}

async function readBody(request){
  if(!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get("content-type")??"")||!request.body)return null;
  const reader=request.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let size=0,text="";
  try {
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_BODY){void reader.cancel().catch(()=>{});return null;}
      text+=decoder.decode(value,{stream:true});
    }
    return JSON.parse(text+decoder.decode());
  } catch {return null;}
}

export function createMerchantAppearanceHandler({enabled=false,db,verifyIdentity}={}){
  return async function handle(request,tenantId,action){
    if(enabled!==true||typeof verifyIdentity!=="function"||typeof db?.prepare!=="function")return fail(404,"not_found");
    if(typeof tenantId!=="string"||!ID.test(tenantId)||!["read","save","publish"].includes(action))
      return fail(404,"not_found");
    if(request.method!==(action==="read"?"GET":"POST"))return fail(405,"method_not_allowed");
    try {
      const identity=await verifyIdentity(request);
      if(!identity)return fail(401,"unauthenticated");
      const bind=(sql,...args)=>db.prepare(sql).bind(tenantId,identity.issuer,identity.subject,...args).first();
      let row;
      if(action==="read"){
        row=await bind(SELECT);
      }else{
        const data=await readBody(request);
        const keys=action==="save"?["revision","settings"]:["revision"];
        if(!fields(data,keys)||!Number.isSafeInteger(data.revision)||data.revision<0||data.revision>MAX_REVISION)
          return fail(400,"invalid_input");
        if(action==="save"){
          const state=settings(data.settings);
          if(!state)return fail(400,"invalid_input");
          row=await (data.revision===0?bind(INSERT,JSON.stringify(state)):bind(UPDATE,JSON.stringify(state),data.revision));
        }else if(data.revision>0){
          const old=await bind(SELECT);
          if(!old)return fail(404,"not_found");
          if(old.revision===data.revision){
            if(!settings(JSON.parse(old.draft_json)))return fail(503,"appearance_unavailable");
            row=await bind(PUBLISH,data.revision,old.draft_json);
          }
        }
        if(!row)return (await bind(SELECT))?fail(409,"revision_conflict"):fail(404,"not_found");
      }
      if(!row)return fail(404,"not_found");
      const draft=row.draft_json===null?{...DEFAULT_SETTINGS}:settings(JSON.parse(row.draft_json));
      const published=row.published_json===null?null:settings(JSON.parse(row.published_json));
      if(!draft||(row.published_json!==null&&!published))return fail(503,"appearance_unavailable");
      return reply({draft,published,revision:row.revision??0},200);
    } catch {
      return fail(503,"appearance_unavailable");
    }
  };
}
