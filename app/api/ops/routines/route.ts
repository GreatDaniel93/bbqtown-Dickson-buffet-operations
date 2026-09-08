import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";
const clean=(v:unknown,n=500)=>String(v??"").trim().slice(0,n);

const defaults = [
  ['open_food_safety','Opening food safety check','Complete opening hygiene / handwash / food-contact check.','FOOD SAFETY','DAILY',10],
  ['open_temperatures','Opening temperature checks','Record coolroom, fridges and freezers before service.','FOOD SAFETY','DAILY',20],
  ['buffet_pre_service','Buffet pre-service check','Confirm hot/cold display, labels and service area are ready.','OPERATIONS','DAILY',30],
  ['close_food_safety','Closing food safety check','Complete closing storage, cleaning and corrective-action review.','FOOD SAFETY','DAILY',40],
  ['handover','Manager handover','Leave the next shift a short handover if anything needs attention.','MANAGEMENT','DAILY',50],
  ['probe_check','Probe thermometer accuracy','Check thermometer accuracy and record calibration result.','FOOD SAFETY','WEEKLY',110],
  ['deep_clean','Weekly deep clean','Complete weekly deep-clean focus areas and record issues.','CLEANING','WEEKLY',120],
  ['equipment_check','Equipment condition check','Check fridge seals, dishwasher, exhaust, plumbing and obvious damage.','MAINTENANCE','WEEKLY',130],
  ['pest_review','Pest-control review','Review pest sightings and ensure unresolved activity has an incident.','FOOD SAFETY','WEEKLY',140],
  ['documents_review','Compliance document review','Check upcoming expiry/review dates and update the document register.','MANAGEMENT','MONTHLY',210]
] as const;

async function seed(sql:any){
  for(const d of defaults){
    await sql`INSERT INTO ops_routines (task_key,title,description,category,frequency,sort_order) VALUES (${d[0]},${d[1]},${d[2]},${d[3]},${d[4]},${d[5]}) ON CONFLICT (task_key) DO NOTHING`;
  }
}

function daysBetween(a:string,b:string){
  const x=Date.parse(a+'T00:00:00Z'), y=Date.parse(b+'T00:00:00Z');
  return Math.floor((x-y)/86400000);
}

export async function GET(request:Request){
  try{
    const sql=await ensureOpsSchema(); await seed(sql);
    const url=new URL(request.url); const date=clean(url.searchParams.get('date'),20)||new Date().toISOString().slice(0,10);
    const routines=await sql`SELECT * FROM ops_routines WHERE active=true ORDER BY sort_order,title`;
    const logs=await sql`SELECT l.*,r.task_key FROM ops_routine_logs l JOIN ops_routines r ON r.id=l.routine_id WHERE l.service_date<=${date} ORDER BY l.completed_at DESC LIMIT 1000`;
    const byKey=new Map<string,any[]>();
    for(const l of logs){const k=String(l.task_key);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k)!.push(l)}
    const tasks=routines.map((r:any)=>{
      const arr=byKey.get(String(r.task_key))||[]; const today=arr.find((x:any)=>x.service_date===date); const last=arr[0];
      let due=true;
      if(r.frequency==='WEEKLY'&&last)due=daysBetween(date,String(last.service_date))>=7;
      if(r.frequency==='MONTHLY'&&last)due=daysBetween(date,String(last.service_date))>=30;
      if(r.frequency==='DAILY')due=!today;
      return {...r,completed:!!today,completed_at:today?Number(today.completed_at):null,completed_by:today?.completed_by||'',notes:today?.notes||'',last_completed_date:last?.service_date||'',due};
    });
    return Response.json({date,tasks});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Database unavailable'},{status:500})}
}

export async function POST(request:Request){
  try{
    const body=await request.json(); const sql=await ensureOpsSchema(); await seed(sql);
    const taskKey=clean(body.taskKey,120), date=clean(body.date,20)||new Date().toISOString().slice(0,10), complete=body.completed!==false;
    const [routine]=await sql`SELECT id,title FROM ops_routines WHERE task_key=${taskKey} AND active=true`;
    if(!routine)return Response.json({error:'Task not found'},{status:404});
    if(complete){
      const now=Date.now(), by=clean(body.completedBy,120), notes=clean(body.notes,1000);
      await sql`INSERT INTO ops_routine_logs (routine_id,service_date,completed_at,completed_by,notes) VALUES (${routine.id},${date},${now},${by},${notes}) ON CONFLICT (routine_id,service_date) DO UPDATE SET completed_at=EXCLUDED.completed_at,completed_by=EXCLUDED.completed_by,notes=EXCLUDED.notes`;
      await sql`INSERT INTO ops_events (created_at,device_id,role,event_type,label,payload) VALUES (${now},'','manager','ROUTINE_COMPLETE',${routine.title},${JSON.stringify({taskKey,date,completedBy:by})}::jsonb)`;
    }else{
      await sql`DELETE FROM ops_routine_logs WHERE routine_id=${routine.id} AND service_date=${date}`;
    }
    return Response.json({ok:true});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Database unavailable'},{status:500})}
}
