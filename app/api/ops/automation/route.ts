import { ensureOpsSchema } from "../../_lib/ops-store";

export const dynamic = "force-dynamic";

const SYDNEY = "Australia/Sydney";
const DAY = 86400000;

function sydneyParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: SYDNEY,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function minutesNow() {
  const p = sydneyParts();
  return p.hour * 60 + p.minute;
}

const DAILY_DUE: Record<string, { weekday: number; weekend: number }> = {
  open_food_safety: { weekday: 16 * 60 + 30, weekend: 10 * 60 + 30 },
  open_temperatures: { weekday: 16 * 60 + 30, weekend: 10 * 60 + 30 },
  buffet_pre_service: { weekday: 17 * 60, weekend: 11 * 60 },
  close_food_safety: { weekday: 21 * 60 + 15, weekend: 21 * 60 + 15 },
  handover: { weekday: 21 * 60 + 30, weekend: 21 * 60 + 30 },
};

async function ensureIncident(sql: any, key: string, input: {category:string; severity:string; title:string; details:string; dueAt?:number}) {
  const [existing] = await sql`SELECT * FROM ops_automation_keys WHERE automation_key=${key}`;
  if (existing?.state === "OPEN" && existing?.incident_id) return Number(existing.incident_id);
  const now = Date.now();
  const [incident] = await sql`
    INSERT INTO ops_incidents (created_at,updated_at,category,severity,title,details,status,owner,due_at)
    VALUES (${now},${now},${input.category},${input.severity},${input.title},${input.details},'OPEN','Manager',${input.dueAt ?? now + DAY})
    RETURNING id
  `;
  await sql`
    INSERT INTO ops_automation_keys (automation_key,incident_id,state,created_at,updated_at)
    VALUES (${key},${incident.id},'OPEN',${now},${now})
    ON CONFLICT (automation_key) DO UPDATE SET incident_id=EXCLUDED.incident_id,state='OPEN',updated_at=EXCLUDED.updated_at
  `;
  await sql`INSERT INTO ops_events (created_at,device_id,role,event_type,label,payload) VALUES (${now},'','manager','AUTO_INCIDENT',${input.title},${JSON.stringify({key,incidentId:Number(incident.id)})}::jsonb)`;
  return Number(incident.id);
}

async function closeAutomationIncident(sql:any,key:string,resolution:string){
  const [row]=await sql`SELECT * FROM ops_automation_keys WHERE automation_key=${key}`;
  if(!row?.incident_id || row.state!=='OPEN') return;
  const now=Date.now();
  await sql`UPDATE ops_incidents SET status='CLOSED',updated_at=${now},closed_at=${now},action_taken=${resolution} WHERE id=${row.incident_id} AND status='OPEN'`;
  await sql`UPDATE ops_automation_keys SET state='CLOSED',updated_at=${now} WHERE automation_key=${key}`;
}

export async function GET() {
  try {
    const sql = await ensureOpsSchema();
    const now = Date.now();
    const p = sydneyParts();
    const weekend = p.weekday === "Sat" || p.weekday === "Sun";
    const minute = minutesNow();
    const since7d = now - 7 * DAY;

    const fails = await sql`SELECT * FROM food_safety_logs WHERE result='FAIL' AND created_at>=${since7d} ORDER BY created_at DESC LIMIT 100`;
    for (const f of fails) {
      await ensureIncident(sql, `health-fail-${f.id}`, {
        category: "FOOD SAFETY",
        severity: "high",
        title: `Food safety corrective action: ${String(f.item).slice(0,100)}`,
        details: `${f.log_type} failed. Reading: ${f.reading || 'n/a'} ${f.unit || ''}. Recorded action: ${f.corrective_action || 'none'}. Review and confirm the issue is fully resolved.`,
        dueAt: Math.min(now + DAY, Number(f.created_at) + DAY),
      });
    }

    const devices = await sql`SELECT * FROM ops_devices ORDER BY last_seen DESC`;
    for (const d of devices) {
      const stale = now - Number(d.last_seen) > 10 * 60 * 1000;
      const key = `device-offline-${d.device_id}`;
      if (stale) {
        await ensureIncident(sql, key, {
          category: "TABLET / APP",
          severity: "normal",
          title: `Device offline: ${d.role}`,
          details: `Device ${d.device_id} has not reported for more than 10 minutes. Check power, Wi-Fi, app state and sound test.`,
          dueAt: now + 4 * 60 * 60 * 1000,
        });
      } else {
        await closeAutomationIncident(sql, key, "Device recovered and resumed heartbeat automatically.");
      }
    }

    const routines = await sql`SELECT r.*,l.completed_at,l.completed_by FROM ops_routines r LEFT JOIN ops_routine_logs l ON l.routine_id=r.id AND l.service_date=${p.date} WHERE r.active=true ORDER BY r.sort_order,r.title`;
    const daily = routines.filter((r:any)=>r.frequency==='DAILY');
    const overdueTasks = daily.filter((r:any)=>{
      if (r.completed_at) return false;
      const due=DAILY_DUE[String(r.task_key)];
      if(!due) return false;
      return minute >= (weekend?due.weekend:due.weekday);
    }).map((r:any)=>({taskKey:r.task_key,title:r.title,category:r.category}));

    const closingCriticalKeys = new Set(['open_food_safety','open_temperatures','buffet_pre_service','close_food_safety']);
    const closingBlock = minute >= 20 * 60 + 45
      ? daily.filter((r:any)=>closingCriticalKeys.has(String(r.task_key)) && !r.completed_at).map((r:any)=>({taskKey:r.task_key,title:r.title}))
      : [];

    const openIncidents = await sql`SELECT * FROM ops_incidents WHERE status='OPEN' ORDER BY updated_at DESC`;
    const overdueIncidents = openIncidents.filter((x:any)=>x.due_at && Number(x.due_at)<now);
    const events = await sql`SELECT event_type,label,created_at FROM ops_events WHERE created_at>=${since7d} ORDER BY created_at DESC LIMIT 2000`;
    const lowEmpty = events.filter((e:any)=>['LOW','EMPTY'].includes(String(e.event_type))).length;
    const sla = events.filter((e:any)=>String(e.event_type).startsWith('SLA_')).length;
    const deviceIssues = devices.filter((d:any)=>now-Number(d.last_seen)>10*60*1000).length;
    const routineLogs = await sql`SELECT service_date,COUNT(*)::int AS count FROM ops_routine_logs WHERE service_date>=${new Date(now-7*DAY).toISOString().slice(0,10)} GROUP BY service_date`;
    const completed7d = routineLogs.reduce((a:number,x:any)=>a+Number(x.count||0),0);

    return Response.json({
      date:p.date,
      automated:true,
      overdueTasks,
      closingBlock,
      weeklyReview:{
        foodSafetyFails:fails.length,
        overdueIncidents:overdueIncidents.length,
        lowEmptyEvents:lowEmpty,
        kitchenSlaBreaches:sla,
        completedRoutineTasks:completed7d,
        deviceIssues,
      }
    });
  } catch (error) {
    return Response.json({error:error instanceof Error?error.message:"Automation unavailable"},{status:500});
  }
}
