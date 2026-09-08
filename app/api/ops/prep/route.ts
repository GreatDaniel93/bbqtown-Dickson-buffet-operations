import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";
const clean=(v:unknown,n=500)=>String(v??"").trim().slice(0,n);

export async function GET(request:Request){
  try{
    const sql=await ensureOpsSchema();
    const url=new URL(request.url);
    const date=clean(url.searchParams.get('date'),20)||new Date().toISOString().slice(0,10);
    const section=clean(url.searchParams.get('section'),20).toUpperCase();
    const items=section&&section!=='ALL'
      ? await sql`SELECT * FROM kitchen_prep_items WHERE prep_date=${date} AND section IN (${section},'ALL') ORDER BY completed,sort_order,id`
      : await sql`SELECT * FROM kitchen_prep_items WHERE prep_date=${date} ORDER BY completed,section,sort_order,id`;
    return Response.json({date,items});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Database unavailable'},{status:500})}
}

export async function POST(request:Request){
  try{
    const body=await request.json(); const sql=await ensureOpsSchema(); const action=clean(body.action,40); const now=Date.now();
    if(action==='add'){
      const prepDate=clean(body.prepDate,20),item=clean(body.item,180); if(!prepDate||!item)return Response.json({error:'prepDate and item required'},{status:400});
      const section=clean(body.section,20).toUpperCase()||'ALL';
      const [created]=await sql`INSERT INTO kitchen_prep_items (prep_date,section,item,quantity,notes,sort_order,created_at,created_by) VALUES (${prepDate},${section},${item},${clean(body.quantity,80)},${clean(body.notes,600)},${Number(body.sortOrder)||0},${now},${clean(body.createdBy,120)}) RETURNING *`;
      return Response.json({ok:true,item:created});
    } else if(action==='toggle'){
      const id=Number(body.id); if(!id)return Response.json({error:'id required'},{status:400});
      const completed=!!body.completed;
      const [updated]=await sql`UPDATE kitchen_prep_items SET completed=${completed},completed_at=${completed?now:null},completed_by=${completed?clean(body.completedBy,120):''} WHERE id=${id} RETURNING *`;
      if(!updated)return Response.json({error:'Prep item not found'},{status:404});
      return Response.json({ok:true,item:updated});
    } else if(action==='delete'){
      const id=Number(body.id); if(!id)return Response.json({error:'id required'},{status:400});
      await sql`DELETE FROM kitchen_prep_items WHERE id=${id}`;
      return Response.json({ok:true});
    } else if(action==='carry'){
      const fromDate=clean(body.fromDate,20),toDate=clean(body.toDate,20); if(!fromDate||!toDate)return Response.json({error:'fromDate and toDate required'},{status:400});
      const rows=await sql`SELECT section,item,quantity,notes,sort_order FROM kitchen_prep_items WHERE prep_date=${fromDate} AND completed=false ORDER BY sort_order,id`;
      for(const r of rows){
        await sql`INSERT INTO kitchen_prep_items (prep_date,section,item,quantity,notes,sort_order,created_at,created_by) SELECT ${toDate},${r.section},${r.item},${r.quantity},${r.notes},${r.sort_order},${now},${clean(body.createdBy,120)} WHERE NOT EXISTS (SELECT 1 FROM kitchen_prep_items WHERE prep_date=${toDate} AND section=${r.section} AND lower(item)=lower(${r.item}))`;
      }
      return Response.json({ok:true});
    } else return Response.json({error:'Unknown action'},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Database unavailable'},{status:500})}
}
