import {normalizeSettings} from "../web/theme.mjs";

const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const idPattern=/^[A-Za-z0-9_-]{1,64}$/;
const HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-robots-tag":"noindex"};
const reply=(status,body,headers)=>new Response(JSON.stringify(body),{status,headers:{...HEADERS,...headers}});

// One tenant + one location + one published configuration in the same snapshot.
// A draft, disabled tenant/location, or unpublished storefront never falls back to demo data.
const MENU_SQL=`
 SELECT t.slug,t.name AS tenant_name,l.id AS location_id,l.name AS location_name,a.published_json,dt.label AS table_label,
  COALESCE((SELECT json_group_array(json_object(
      'id', m.id, 'name',m.name,'description',m.description,'priceCents',m.price_cents,
      'available',json(CASE m.availability WHEN 'available' THEN 'true' ELSE 'false' END),
      'categoryId',m.category_id,'categoryName',m.category_name,'addons',json(m.addons)
    )) FROM (
    SELECT i.*, c.id AS category_id,c.name AS category_name,
      COALESCE((SELECT json_group_array(json_object('id', x.id,'name',x.name,'priceCents',x.price_cents))
        FROM (SELECT id,name,price_cents FROM menu_addons
          WHERE tenant_id=t.id AND menu_item_id=i.id AND is_available=1
          ORDER BY name,id LIMIT 24) x),'[]') AS addons
    FROM menu_items i
    LEFT JOIN menu_item_categories ic ON ic.tenant_id=i.tenant_id AND ic.location_id=i.location_id AND ic.item_id=i.id
    LEFT JOIN menu_categories c ON c.tenant_id=i.tenant_id AND c.location_id=i.location_id AND c.id=ic.category_id
    WHERE i.tenant_id=t.id AND i.location_id=l.id AND i.availability IN ('available','sold_out')
      AND (ic.category_id IS NULL OR c.is_active=1)
    ORDER BY COALESCE(c.sort_order,2147483647),i.name,i.id LIMIT 201
  ) m),'[]') AS items_json
 FROM tenants t
 JOIN locations l ON l.tenant_id=t.id
 JOIN tenant_appearances a ON a.tenant_id=t.id AND a.location_id=''
 LEFT JOIN dining_tables dt ON dt.tenant_id=t.id AND dt.location_id=l.id AND dt.id=? AND dt.is_active=1
 WHERE t.slug=? AND l.id=? AND t.status='active' AND l.status='active' AND a.published_json IS NOT NULL
   AND (? IS NULL OR dt.id IS NOT NULL)`;

export const validMenuPath=(slug,locationId)=>typeof slug==="string"&&typeof locationId==="string"&&slugPattern.test(slug)&&idPattern.test(locationId);

export async function handlePublicMenu(request,{enabled=false,db,slug,locationId}={}){
  if(enabled!==true||!validMenuPath(slug,locationId))return reply(404,{error:"Cardápio não publicado"});
  if(request.method!=="GET")return reply(405,{error:"Método não permitido"},{allow:"GET"});
  try{
    const selectors=new URL(request.url).searchParams.getAll("mesa");
    if(selectors.length>1||(selectors.length===1&&!idPattern.test(selectors[0])))
      return reply(404,{error:"Cardápio não publicado ou mesa indisponível"});
    const tableId=selectors[0]??null;
    const row=await db.prepare(MENU_SQL).bind(tableId,slug,locationId,tableId).first();
    if(!row)return reply(404,{error:"Cardápio não publicado"});
    const items=JSON.parse(row.items_json);
    return reply(200,{slug:row.slug,name:row.tenant_name,location:{id:row.location_id,name:row.location_name},
      ...(row.table_label?{table:{label:row.table_label}}:{}),appearance:normalizeSettings(JSON.parse(row.published_json)),items:items.slice(0,200),limited:items.length>200,orderingEnabled:false});
  }catch{
    return reply(503,{error:"Cardápio temporariamente indisponível"});
  }
}
