// Pilot kitchen: disabled by default, scoped to verified operational membership.
const ROOT="/v1/merchant/kitchen";
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const MAX_BODY=2048;
const id=x=>typeof x==="string"&&ID.test(x);
const identity=x=>typeof x?.issuer==="string"&&typeof x?.subject==="string"&&/^[\x21-\x7e]{1,255}$/.test(x.subject);
const flow={
  submitted:["accepted","rejected"], accepted:["preparing"], preparing:["ready"], ready:["completed"]
};
const states=["submitted","accepted","preparing","ready","completed","rejected","cancelled"];
const roles=new Set(["owner","manager","attendant","viewer"]);
const allowed=(status,role,payment)=>payment!=="not_required"||role==="viewer"||!roles.has(role)?[]:
  (Object.hasOwn(flow,status)?flow[status]:[]).filter(next=>role!=="attendant"||["accepted","rejected","completed"].includes(next));
const ok=(data,status=200)=>Response.json(data,{status,headers:{
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"
}});
const err=(status,error)=>ok({error},status);
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const scope=`WITH requested(tenant_id,location_id,issuer,subject) AS (VALUES(?,?,?,?)),
  membership AS (SELECT s.tenant_id,s.location_id,s.staff_id,s.role FROM requested r
    JOIN order_staff_memberships s ON s.tenant_id=r.tenant_id AND s.location_id=r.location_id
      AND s.issuer=r.issuer AND s.subject=r.subject AND s.status='active'
    JOIN tenants t ON t.id=s.tenant_id AND t.status='active'
    JOIN locations l ON l.tenant_id=s.tenant_id AND l.id=s.location_id AND l.status='active')`;
const fields=`o.id,o.status,o.payment_status AS paymentStatus,o.total_cents AS totalCents,o.currency,
  d.label AS tableLabel,o.created_at AS createdAt,o.updated_at AS updatedAt`;
const view=` FROM membership m JOIN orders o ON o.tenant_id=m.tenant_id AND o.location_id=m.location_id
  LEFT JOIN dining_tables d ON d.tenant_id=o.tenant_id AND d.location_id=o.location_id AND d.id=o.table_id`;
function validOrigin(x) {
  try {const u=new URL(x);return u.origin===x&&(u.protocol==="https:"||(u.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(u.hostname)));}
  catch {return false;}
}
async function body(request) {
  if(!request.body||request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")return null;
  const reader=request.body.getReader();
  try {
    const decoder=new TextDecoder("utf-8",{fatal:true});
    let size=0,s="";
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_BODY){void reader.cancel().catch(()=>{});return null;}
      s+=decoder.decode(value,{stream:true});
    }
    const data=JSON.parse(s+decoder.decode());
    return data&&typeof data==="object"&&!Array.isArray(data)?data:null;
  }catch{return null;}
  finally{reader.releaseLock();}
}
async function units(db,user){
  const res=await stmt(db,`SELECT s.tenant_id AS tenantId,t.name AS tenantName,s.location_id AS locationId,
    l.name AS locationName,s.role FROM order_staff_memberships s
    JOIN tenants t ON t.id=s.tenant_id AND t.status='active'
    JOIN locations l ON l.tenant_id=s.tenant_id AND l.id=s.location_id AND l.status='active'
    WHERE s.issuer=? AND s.subject=? AND s.status='active'
    ORDER BY t.name,l.name,s.tenant_id,s.location_id LIMIT 101`,user.issuer,user.subject).all();
  if(!res.success)return err(503,"kitchen_unavailable");
  return ok({units:res.results.slice(0,100),limited:res.results.length>100});
}
async function list(db,args){
  const result=await db.batch([
    stmt(db,`${scope} SELECT 1 FROM membership`,...args),
    stmt(db,`${scope} SELECT ${fields}${view}
      ORDER BY CASE WHEN o.status IN ('submitted','accepted','preparing','ready') THEN 0 ELSE 1 END,
      o.created_at DESC,o.id DESC LIMIT 51`,...args)
  ]);
  if(result.some(r=>!r.success))return err(503,"kitchen_unavailable");
  if(!result[0].results.length)return err(404,"not_found");
  const rows=result[1].results;
  return ok({orders:rows.slice(0,50),limited:rows.length>50});
}
async function detail(db,args,orderId){
  const result=await db.batch([
    stmt(db,`${scope} SELECT ${fields},m.role${view} WHERE o.id=?`,...args,orderId),
    stmt(db,`${scope} SELECT n.id,n.name_snapshot AS name,n.quantity,n.unit_price_cents AS unitPriceCents,
      n.total_cents AS totalCents,n.addons_json,n.notes FROM membership m
      JOIN orders o ON o.tenant_id=m.tenant_id AND o.location_id=m.location_id
      JOIN order_lines n ON n.tenant_id=o.tenant_id AND n.order_id=o.id
      WHERE o.id=? ORDER BY n.id LIMIT 51`,...args,orderId)
  ]);
  if(result.some(r=>!r.success))return err(503,"kitchen_unavailable");
  const row=result[0].results[0];
  if(!row)return err(404,"not_found");
  if(result[1].results.length>50)return err(503,"kitchen_unavailable");
  const {role,...summary}=row;
  const lines=result[1].results.map(({addons_json,...line})=>{
    const addons=JSON.parse(addons_json);
    if(!Array.isArray(addons))throw new Error("invalid order snapshot");
    return {...line,addons};
  });
  return ok({order:{...summary,lines,allowedTransitions:allowed(row.status,role,row.paymentStatus)}});
}
async function transition(db,args,orderId,request){
  const data=await body(request);
  if(!data||Object.keys(data).some(k=>!["status","expectedStatus","reason"].includes(k))||
    !states.includes(data.status)||!states.includes(data.expectedStatus))return err(400,"invalid_data");
  let reason=null;
  if(data.status==="rejected"){
    if(typeof data.reason!=="string"||/[\p{Cc}]/u.test(data.reason)||data.reason.trim().length<1||data.reason.trim().length>240)
      return err(400,"reason_required");
    reason=data.reason.trim();
  }else if(data.reason!==undefined&&data.reason!==null)return err(400,"reason_not_allowed");
  const uid=crypto.randomUUID();
  const result=await db.batch([
    // Source membership and state are re-read in the same statement as the audited command.
    // The trigger atomically applies the change and appends an event or rolls everything back.
    stmt(db,`${scope} INSERT INTO merchant_kitchen_transitions(id,tenant_id,location_id,order_id,staff_id,old_status,new_status,reason)
      SELECT ?,m.tenant_id,m.location_id,o.id,m.staff_id,o.status,?,? FROM membership m
      JOIN orders o ON o.tenant_id=m.tenant_id AND o.location_id=m.location_id
      WHERE o.id=? AND o.status=? AND o.payment_status='not_required'
        AND ((m.role IN ('owner','manager') AND
          ((o.status='submitted' AND ? IN ('accepted','rejected')) OR (o.status='accepted' AND ?='preparing')
            OR (o.status='preparing' AND ?='ready') OR (o.status='ready' AND ?='completed')))
          OR (m.role='attendant' AND ((o.status='submitted' AND ? IN ('accepted','rejected'))
            OR (o.status='ready' AND ?='completed'))))`,
      ...args,uid,data.status,reason,orderId,data.expectedStatus,...Array(6).fill(data.status)),
    stmt(db,`${scope} SELECT o.id,o.status,o.updated_at AS updatedAt${view} WHERE o.id=?`,...args,orderId),
  ]);
  if(result.some(r=>!r.success))return err(503,"kitchen_unavailable");
  const order=result[1].results[0];
  if(!order)return err(404,"not_found");
  if(result[0].meta?.changes<1||order.status!==data.status||!Number.isInteger(result[0].meta?.changes))
    return err(409,"transition_not_available");
  return ok(order);
}
export function createMerchantKitchen({enabled=false,origin,db,verifyIdentity}={}){
  const configured=enabled===true&&validOrigin(origin)&&typeof db?.prepare==="function"&&
    typeof db.batch==="function"&&typeof verifyIdentity==="function";
  return async function handleKitchen(request){
    const url=new URL(request.url),path=url.pathname;
    if(path!==ROOT&&!path.startsWith(ROOT+"/"))return null;
    if(!configured||url.origin!==origin)return err(404,"not_found");
    const method=request.method,tail=path.slice(ROOT.length+1);
    const unitRoster=tail==="units"&&method==="GET";
    const p=tail.split("/");
    const [tenant,location,resource,orderId,action]=p;
    const validScope=id(tenant)&&id(location)&&resource==="orders";
    const listing=validScope&&method==="GET"&&p.length===3;
    const order=validScope&&method==="GET"&&p.length===4&&id(orderId);
    const write=validScope&&method==="POST"&&p.length===5&&id(orderId)&&action==="transition";
    if(!unitRoster&&!listing&&!order&&!write)return err(404,"not_found");
    if(write&&request.headers.get("origin")!==origin)return err(403,"invalid_origin");
    try {
      const user=await verifyIdentity(request);
      if(!identity(user))return err(401,"authentication_required");
      if(unitRoster)return await units(db,user);
      const args=[tenant,location,user.issuer,user.subject];
      if(listing)return await list(db,args);
      if(order)return await detail(db,args,orderId);
      return await transition(db,args,orderId,request);
    }catch{return err(503,"kitchen_unavailable");}
  };
}
