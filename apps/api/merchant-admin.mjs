// Disabled by default. All owner and provisioning authority is server-side.
const ROOT="/v1/merchant/tenants";
const ID=/^[A-Za-z0-9_-]{1,64}$/;
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUBJECT=/^[\x21-\x7e]{1,255}$/;
const MAX_BODY=8192;
const CATALOG_LIMIT=250;
const itemStates=["available","sold_out","hidden"];
const OWNER=`EXISTS (SELECT 1 FROM merchant_owners o JOIN tenants t ON t.id=o.tenant_id
  WHERE o.tenant_id=? AND o.issuer=? AND o.subject=? AND o.status='active' AND t.status='active')`;
const UNIT="EXISTS (SELECT 1 FROM locations WHERE tenant_id=? AND id=? AND status='active')";
const ITEM="EXISTS (SELECT 1 FROM menu_items WHERE tenant_id=? AND location_id=? AND id=?)";
const CATEGORY="EXISTS (SELECT 1 FROM menu_categories WHERE tenant_id=? AND location_id=? AND id=?)";
const isId=x=>typeof x==="string"&&ID.test(x);
const isSlug=x=>typeof x==="string"&&x.length<=48&&SLUG.test(x);
const isText=(x,n)=>typeof x==="string"&&x.trim().length>0&&x.trim().length<=n&&!/[\p{Cc}]/u.test(x);
const isMoney=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000000;
const identity=x=>typeof x?.issuer==="string"&&typeof x?.subject==="string"&&SUBJECT.test(x.subject);
const error=(status,code)=>respond({error:code},status);
const respond=(body,status=200)=>Response.json(body,{status,headers:{
  "Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"
}});
const changes=result=>result?.meta?.changes??0;
const rows=result=>result.results;
const ownerArgs=(tenant,user)=>[tenant,user.issuer,user.subject];

async function bodyFrom(request) {
  if(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json"||!request.body)return null;
  const declared=request.headers.get("content-length");
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))return null;
  const reader=request.body.getReader();
  try {
    const decoder=new TextDecoder("utf-8",{fatal:true});
    let value="",total=0;
    for (;;) {
      const chunk=await reader.read();
      if(chunk.done)break;
      total+=chunk.value.byteLength;
      if(total>MAX_BODY){void reader.cancel().catch(()=>{});return null;}
      value+=decoder.decode(chunk.value,{stream:true});
    }
    const body=JSON.parse(value+decoder.decode());
    return body&&typeof body==="object"&&!Array.isArray(body)?body:null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}
function validOrigin(origin) {
  try { const url=new URL(origin); return url.origin===origin &&
    (url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))); }
  catch { return false; }
}
const only=(body,...fields)=>Object.keys(body).every(key=>fields.includes(key));
const sql=(db,query,...args)=>db.prepare(query).bind(...args);

async function provision(db,user,body,grants) {
  const {slug,name,locationName}=body;
  if(!only(body,"slug","name","locationName")||!isSlug(slug)||!isText(name,100)||!isText(locationName,100))
    return error(400,"invalid_data");
  if(!grants.some(g=>g.issuer===user.issuer&&g.subject===user.subject&&g.slug===slug))
    return error(403,"provision_not_allowed");
  const t=crypto.randomUUID(),l=crypto.randomUUID(),s=crypto.randomUUID();
  const {issuer,subject}=user;
  const result=await db.batch([
    sql(db,`INSERT INTO tenants(id,slug,name,status) SELECT ?,?,?,'active'
      WHERE NOT EXISTS (SELECT 1 FROM merchant_provisioning WHERE issuer=? AND subject=? AND slug=?)
      ON CONFLICT(slug) DO NOTHING`,t,slug,name.trim(),issuer,subject,slug),
    sql(db,`INSERT INTO merchant_provisioning(issuer,subject,slug,tenant_id)
      SELECT ?,?,?,id FROM tenants WHERE id=?`,issuer,subject,slug,t),
    sql(db,`INSERT INTO merchant_owners(tenant_id,issuer,subject,staff_id,status)
      SELECT id,?,?,?,'active' FROM tenants WHERE id=?`,issuer,subject,s,t),
    sql(db,`INSERT INTO locations(id,tenant_id,name,status)
      SELECT ?,id,?,'active' FROM tenants WHERE id=?`,l,locationName.trim(),t),
    sql(db,`INSERT INTO order_staff_memberships(issuer,subject,staff_id,tenant_id,location_id,role,status)
      SELECT ?,?,?,tenant_id,id,'owner','active' FROM locations WHERE tenant_id=? AND id=?`,issuer,subject,s,t,l),
  ]);
  if(result.some(step=>step.success!==true))return error(503,"merchant_unavailable");
  if(changes(result[0])!==1)return error(409,"provision_consumed_or_slug_unavailable");
  if(result.some(step=>changes(step)!==1))return error(503,"merchant_unavailable");
  return respond({tenant:{id:t,slug,name:name.trim()},location:{id:l,name:locationName.trim()}},201);
}

async function catalog(db,t,user) {
  const args=ownerArgs(t,user);
  const statements=[
    ["locations","SELECT id,name,status FROM locations WHERE tenant_id=?","name,id"],
    ["tables","SELECT id,location_id AS locationId,label AS name,is_active AS isActive FROM dining_tables WHERE tenant_id=?","location_id,label,id"],
    ["categories",`SELECT id,location_id AS locationId,name,sort_order AS sortOrder,is_active AS isActive
      FROM menu_categories WHERE tenant_id=?`,"location_id,sort_order,name,id"],
    ["items",`SELECT i.id,i.location_id AS locationId,c.category_id AS categoryId,i.name,i.description,
      i.price_cents AS priceCents,i.availability FROM menu_items i
      LEFT JOIN menu_item_categories c ON c.tenant_id=i.tenant_id AND c.location_id=i.location_id AND c.item_id=i.id
      WHERE i.tenant_id=?`,"i.location_id,i.name,i.id"],
    ["addons",`SELECT a.id,i.location_id AS locationId,a.menu_item_id AS itemId,a.name,
      a.price_cents AS priceCents,a.is_available AS isAvailable FROM menu_addons a
      JOIN menu_items i ON i.tenant_id=a.tenant_id AND i.id=a.menu_item_id WHERE a.tenant_id=?`,"i.location_id,a.name,a.id"]
  ];
  const result=await db.batch([
    sql(db,`SELECT 1 WHERE ${OWNER}`,...args),
    ...statements.map(([,query,order])=>sql(db,`${query} AND ${OWNER} ORDER BY ${order} LIMIT ${CATALOG_LIMIT+1}`,t,...args))
  ]);
  if(result.some(step=>step.success!==true))return error(503,"merchant_unavailable");
  if(rows(result[0]).length!==1)return error(404,"not_found");
  if(result.slice(1).some(r=>rows(r).length>CATALOG_LIMIT))return error(409,"catalog_limit_exceeded");
  return respond(Object.fromEntries(statements.map(([field],index)=>[field,rows(result[index+1]).map(row=>({
    ...row,...((field==="categories"||field==="tables")?{isActive:row.isActive===1}:field==="addons"?{isAvailable:row.isAvailable===1}:{})
  }))])));
}

// IDs in QR/NFC URLs are public menu selectors, never ordering credentials.
async function writeTable(db,t,user,key,b){
  const loc=b.locationId;
  if(!isId(loc))return error(400,"invalid_data");
  const permission=`${OWNER} AND ${UNIT}`, scope=[...ownerArgs(t,user),t,loc];
  if(key){
    if(!only(b,"locationId","isActive")||b.isActive!==false)return error(400,"invalid_data");
    const [result]=await db.batch([sql(db,`UPDATE dining_tables SET is_active=0
      WHERE tenant_id=? AND location_id=? AND id=? AND ${permission}`,t,loc,key,...scope)]);
    if(result.success!==true)return error(503,"merchant_unavailable");
    return changes(result)===1?respond({id:key,isActive:false}):error(404,"not_found");
  }
  if(!only(b,"locationId","name")||!isText(b.name,48))return error(400,"invalid_data");
  const label=b.name.trim();
  const candidate=crypto.randomUUID();
  const [create,read]=await db.batch([
    sql(db,`INSERT INTO dining_tables(id,tenant_id,location_id,label,is_active)
      SELECT ?,?,?,?,1 WHERE ${permission}
      ON CONFLICT(tenant_id,location_id,label) DO NOTHING`,candidate,t,loc,label,...scope),
    sql(db,`SELECT id,is_active AS isActive FROM dining_tables
      WHERE tenant_id=? AND location_id=? AND label=? AND ${permission}`,t,loc,label,...scope)
  ]);
  if(create.success!==true||read.success!==true)return error(503,"merchant_unavailable");
  const row=read.results?.[0];
  if(!row)return error(404,"not_found");
  // Never reactivate a disabled QR identifier via the create path.
  if(row.isActive!==1)return error(409,"table_label_retired");
  return respond({id:row.id,isActive:true},changes(create)===1?201:200);
}

async function write(db,t,user,kind,key,b) {
  if(kind==="tables")return writeTable(db,t,user,key,b);
  const args=ownerArgs(t,user);
  const id=key||crypto.randomUUID(), editing=Boolean(key);
  const loc=b.locationId, item=b.itemId, cat=b.categoryId??null;
  const order=b.sortOrder??0, available=b.isAvailable??true, categoryActive=b.isActive??true;
  const state=b.availability??"hidden", description=b.description??null;
  if(!isText(b.name,100))return error(400,"invalid_data");
  const name=b.name.trim();
  let statements;
  if(kind==="locations") {
    if(!only(b,"name"))return error(400,"invalid_data");
    statements=editing?[sql(db,`UPDATE locations SET name=? WHERE tenant_id=? AND id=? AND ${OWNER}`,name,t,id,...args)]:[
      sql(db,`INSERT INTO locations(id,tenant_id,name,status) SELECT ?,?,?,'active' WHERE ${OWNER}`,id,t,name,...args),
      sql(db,`INSERT INTO order_staff_memberships(issuer,subject,staff_id,tenant_id,location_id,role,status)
        SELECT o.issuer,o.subject,o.staff_id,o.tenant_id,l.id,'owner','active' FROM merchant_owners o
        JOIN locations l ON l.tenant_id=o.tenant_id AND l.id=?
        WHERE o.tenant_id=? AND o.issuer=? AND o.subject=? AND o.status='active' AND ${OWNER}`,id,...args,...args)
    ];
  }else{
    if(!isId(loc))return error(400,"invalid_data");
    const permission=`${OWNER} AND ${UNIT}`, scope=[...args,t,loc];
    if(kind==="categories"){
      if(!only(b,"locationId","name","sortOrder","isActive")||!Number.isSafeInteger(order)||order<0||order>999||
        typeof categoryActive!=="boolean")return error(400,"invalid_data");
      statements=[editing?sql(db,`UPDATE menu_categories SET name=?,sort_order=?,is_active=?
        WHERE tenant_id=? AND location_id=? AND id=? AND ${permission}`,name,order,+categoryActive,t,loc,id,...scope):
        sql(db,`INSERT INTO menu_categories(id,tenant_id,location_id,name,sort_order,is_active)
        SELECT ?,?,?,?,?,? WHERE ${permission}`,id,t,loc,name,order,+categoryActive,...scope)];
    }else if(kind==="items"){
      if(!only(b,"locationId","categoryId","name","description","priceCents","availability")||
        (cat!==null&&!isId(cat))||(description!==null&&!isText(description,600))||
        !isMoney(b.priceCents)||!itemStates.includes(state))return error(400,"invalid_data");
      const categoryCheck=cat===null?"":` AND ${CATEGORY}`;
      const categoryArgs=cat===null?[]:[t,loc,cat];
      statements=[editing?sql(db,`UPDATE menu_items SET name=?,description=?,price_cents=?,availability=?,updated_at=CURRENT_TIMESTAMP
        WHERE tenant_id=? AND location_id=? AND id=? AND ${permission}${categoryCheck}`,
        name,description?.trim()??null,b.priceCents,state,t,loc,id,...scope,...categoryArgs):
        sql(db,`INSERT INTO menu_items(id,tenant_id,location_id,name,description,price_cents,availability)
        SELECT ?,?,?,?,?,?,? WHERE ${permission}${categoryCheck}`,
        id,t,loc,name,description?.trim()??null,b.priceCents,state,...scope,...categoryArgs)];
      if(cat===null) {
        if(editing)statements.push(sql(db,`DELETE FROM menu_item_categories WHERE tenant_id=? AND location_id=? AND item_id=?
          AND ${permission} AND ${ITEM}`,t,loc,id,...scope,t,loc,id));
      } else statements.push(sql(db,`INSERT INTO menu_item_categories(tenant_id,location_id,item_id,category_id)
        SELECT ?,?,?,? WHERE ${permission} AND ${ITEM} AND ${CATEGORY}
        ON CONFLICT(tenant_id,location_id,item_id) DO UPDATE SET category_id=excluded.category_id`,t,loc,id,cat,...scope,t,loc,id,t,loc,cat));
    }else if(kind==="addons"){
      if(!only(b,"locationId","itemId","name","priceCents","isAvailable")||!isId(item)||!isMoney(b.priceCents)||
        typeof available!=="boolean")return error(400,"invalid_data");
      statements=[editing?sql(db,`UPDATE menu_addons SET name=?,price_cents=?,is_available=?
        WHERE tenant_id=? AND menu_item_id=? AND id=? AND ${permission} AND ${ITEM}`,
        name,b.priceCents,+available,t,item,id,...scope,t,loc,item):
        sql(db,`INSERT INTO menu_addons(id,tenant_id,menu_item_id,name,price_cents,is_available)
        SELECT ?,?,?,?,?,? WHERE ${permission} AND ${ITEM}`,id,t,item,name,b.priceCents,+available,...scope,t,loc,item)];
    }
  }
  const result=await db.batch(statements);
  if(result.some(step=>step.success!==true))return error(503,"merchant_unavailable");
  if(changes(result[0])!==1)return error(404,"not_found");
  return respond({id},editing?200:201);
}

/**
 * Handle only merchant paths; unrelated paths return null. Configured origin, verified
 * external identity and D1 are explicit dependencies. Allowlist entries {issuer,subject,slug}
 * are server config only; one enrollment per entry (enforced in D1).
 */
export function createMerchantAdmin({
  enabled=false,origin,db,verifyIdentity,provisioningAllowlist=[]
}={}){
  const configured=enabled===true&&validOrigin(origin)&&typeof db?.prepare==="function"&&
    typeof db.batch==="function"&&typeof verifyIdentity==="function";
  const grants=Array.isArray(provisioningAllowlist)?provisioningAllowlist.filter(g=>identity(g)&&isSlug(g.slug))
    .map(({issuer,subject,slug})=>({issuer,subject,slug})):[];
  return async function handleMerchantAdmin(request){
    const url=new URL(request.url),path=url.pathname;
    if(path!==ROOT&&!path.startsWith(ROOT+"/"))return null;
    if(!configured||url.origin!==origin)return error(404,"not_found");
    const method=request.method;
    if(method!=="GET"&&request.headers.get("origin")!==origin)return error(403,"invalid_origin");
    const parts=path===ROOT?[]:path.slice(ROOT.length+1).split("/");
    const [t,kind,key]=parts;
    const root=parts.length===0&&["GET","POST"].includes(method);
    const read=parts.length===2&&isId(t)&&kind==="catalog"&&method==="GET";
    const writeRoute=isId(t)&&["locations","tables","categories","items","addons"].includes(kind)&&
      ((parts.length===2&&method==="POST")||(parts.length===3&&isId(key)&&method==="PATCH"));
    if(!root&&!read&&!writeRoute)return error(404,"not_found");
    let user;
    try {user=await verifyIdentity(request);} catch {return error(503,"merchant_unavailable");}
    if(!identity(user))return error(401,"authentication_required");
    try {
      if(root&&method==="GET"){
        const result=await sql(db,`SELECT t.id,t.slug,t.name FROM tenants t
          JOIN merchant_owners o ON o.tenant_id=t.id
          WHERE o.issuer=? AND o.subject=? AND o.status='active' AND t.status='active'
          ORDER BY t.name,t.id LIMIT ${CATALOG_LIMIT+1}`,user.issuer,user.subject).all();
        if(result.success!==true)return error(503,"merchant_unavailable");
        const tenants=rows(result);
        return tenants.length<=CATALOG_LIMIT?respond({tenants}):error(409,"catalog_limit_exceeded");
      }
      if(read)return await catalog(db,t,user);
      const body=await bodyFrom(request);
      if(!body)return error(400,"invalid_data");
      return root?await provision(db,user,body,grants):await write(db,t,user,kind,key,body);
    }catch{return error(503,"merchant_unavailable");}
  };
}
