import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { buffetState } from "../../../db/schema";
export async function GET() {
  try {
    const db=getDb(); const [row]=await db.select().from(buffetState).where(eq(buffetState.id,1)).limit(1);
    if(!row)return Response.json({state:null,updatedAt:0});
    return Response.json({state:JSON.parse(row.payload),updatedAt:row.updatedAt});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:"Database unavailable"},{status:500}); }
}
export async function POST(request:Request) {
  try {
    const body=await request.json() as {foods?:unknown[];logs?:unknown[]};
    if(!Array.isArray(body.foods)||body.foods.length!==56||!Array.isArray(body.logs))return Response.json({error:"Invalid buffet state"},{status:400});
    const updatedAt=Date.now(),payload=JSON.stringify({foods:body.foods,logs:body.logs.slice(0,1000)}),db=getDb();
    await db.insert(buffetState).values({id:1,payload,updatedAt}).onConflictDoUpdate({target:buffetState.id,set:{payload,updatedAt}});
    return Response.json({ok:true,updatedAt});
  } catch(error) { return Response.json({error:error instanceof Error?error.message:"Database unavailable"},{status:500}); }
}
