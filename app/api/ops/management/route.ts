import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";
const clean=(v:unknown,n=1000)=>String(v??"").trim().slice(0,n);

export async function GET() {
  try {
    const sql=await ensureOpsSchema();
    const incidents=await sql`SELECT * FROM ops_incidents ORDER BY CASE WHEN status='OPEN' THEN 0 ELSE 1 END, updated_at DESC LIMIT 200`;
    const handovers=await sql`SELECT * FROM ops_handovers ORDER BY service_date DESC, created_at DESC LIMIT 100`;
    const documents=await sql`SELECT * FROM compliance_documents ORDER BY COALESCE(NULLIF(expiry_date,''),'9999-12-31'), title LIMIT 200`;
    return Response.json({incidents,handovers,documents});
  } catch(error){return Response.json({error:error instanceof Error?error.message:"Database unavailable"},{status:500})}
}

export async function POST(request:Request){
  try{
    const body=await request.json(); const sql=await ensureOpsSchema(); const action=clean(body.action,40); const now=Date.now();
    if(action==='incident'){
      const title=clean(body.title,180),category=clean(body.category,80)||'OTHER'; if(!title)return Response.json({error:'Title required'},{status:400});
      await sql`INSERT INTO ops_incidents (created_at,updated_at,category,severity,title,details,action_taken,status,owner,due_at) VALUES (${now},${now},${category},${clean(body.severity,30)||'normal'},${title},${clean(body.details,2000)},${clean(body.actionTaken,1500)},'OPEN',${clean(body.owner,120)},${body.dueAt?Number(body.dueAt):null})`;
    } else if(action==='incident_update'){
      const id=Number(body.id); if(!id)return Response.json({error:'Incident id required'},{status:400}); const status=clean(body.status,20)||'OPEN'; const closed=status==='CLOSED'?now:null;
      await sql`UPDATE ops_incidents SET updated_at=${now}, status=${status}, action_taken=${clean(body.actionTaken,1500)}, owner=${clean(body.owner,120)}, closed_at=${closed} WHERE id=${id}`;
    } else if(action==='handover'){
      await sql`INSERT INTO ops_handovers (service_date,shift,created_at,created_by,stock_notes,maintenance_notes,food_safety_notes,staff_notes,cleaning_notes,next_shift_notes) VALUES (${clean(body.serviceDate,20)||new Date().toISOString().slice(0,10)},${clean(body.shift,40)||'closing'},${now},${clean(body.createdBy,120)},${clean(body.stockNotes,2000)},${clean(body.maintenanceNotes,2000)},${clean(body.foodSafetyNotes,2000)},${clean(body.staffNotes,2000)},${clean(body.cleaningNotes,2000)},${clean(body.nextShiftNotes,2000)})`;
    } else if(action==='document'){
      const title=clean(body.title,180); if(!title)return Response.json({error:'Document title required'},{status:400});
      await sql`INSERT INTO compliance_documents (document_type,title,reference,issue_date,expiry_date,review_date,location,notes,updated_at) VALUES (${clean(body.documentType,80)||'OTHER'},${title},${clean(body.reference,240)},${clean(body.issueDate,20)},${clean(body.expiryDate,20)},${clean(body.reviewDate,20)},${clean(body.location,300)},${clean(body.notes,1200)},${now})`;
    } else return Response.json({error:'Unknown action'},{status:400});
    return Response.json({ok:true,updatedAt:now});
  } catch(error){return Response.json({error:error instanceof Error?error.message:"Database unavailable"},{status:500})}
}
