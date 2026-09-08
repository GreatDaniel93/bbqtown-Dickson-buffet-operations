package com.bbqtown.dickson.ops

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

private val Ink=Color(0xFF172018); private val Canvas=Color(0xFFF4F3EE); private val Line=Color(0xFFE1E6E0)
private val Muted=Color(0xFF69736C); private val Green=Color(0xFF2F7D4A); private val GreenSoft=Color(0xFFE7F4EA)
private val Gold=Color(0xFFC58213); private val GoldSoft=Color(0xFFFFF1D5); private val Red=Color(0xFFBE3030); private val RedSoft=Color(0xFFFFE8E5)
private val Slate=Color(0xFF52615A)

class OpsActivity:ComponentActivity(){
    private lateinit var prefs:android.content.SharedPreferences
    private var tone:ToneGenerator?=null
    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState); window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        prefs=getSharedPreferences("bbqtown_ops_v2",Context.MODE_PRIVATE)
        setContent{BbqTheme{NativeOpsApp(prefs.getString("role","").orEmpty(),OpsApi(),{prefs.edit().putString("role",it).apply()},{openWeb(it)},{playKitchenAlert()})}}
    }
    private fun openWeb(path:String)=startActivity(Intent(Intent.ACTION_VIEW,Uri.parse("https://bbqtowndickson.com$path")))
    private fun playKitchenAlert(){
        try{if(tone==null)tone=ToneGenerator(AudioManager.STREAM_MUSIC,100);tone?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD,650)}catch(_:Exception){}
        try{val v=getSystemService(Context.VIBRATOR_SERVICE) as Vibrator;val p=longArrayOf(0,160,90,160);if(android.os.Build.VERSION.SDK_INT>=26)v.vibrate(VibrationEffect.createWaveform(p,-1))else{@Suppress("DEPRECATION") v.vibrate(p,-1)}}catch(_:Exception){}
    }
    override fun onDestroy(){tone?.release();tone=null;super.onDestroy()}
}

@Composable private fun BbqTheme(content:@Composable()->Unit){MaterialTheme(colorScheme=lightColorScheme(primary=Ink,onPrimary=Color.White,secondary=Gold,background=Canvas,surface=Color.White,onSurface=Ink,outline=Line),content=content)}
private enum class Role(val key:String,val title:String,val sub:String){FOH("foh","FOH FLOOR","Buffet status and refill requests"),K1("s1","KITCHEN 1","Hot food · meat · seafood"),K2("s2","KITCHEN 2","Vegetables · sides · dessert"),MANAGER("manager","STORE TOOLS","Bookings, tables, vouchers and prep")}

@Composable private fun NativeOpsApp(initialRole:String,api:OpsApi,saveRole:(String)->Unit,openWeb:(String)->Unit,kitchenAlert:()->Unit){
    var role by remember{mutableStateOf(initialRole)};var picker by remember{mutableStateOf(role.isBlank())};var prep by remember{mutableStateOf(false)}
    if(picker){RolePicker(role,{role=it;saveRole(it);picker=false;prep=false},role.isNotBlank()){picker=false};return}
    if(prep){PrepScreen(api,role){prep=false};return}
    when(role){"foh"->FohScreen(api,{picker=true},{prep=true});"s1"->KitchenScreen(api,1,kitchenAlert,{picker=true},{prep=true});"s2"->KitchenScreen(api,2,kitchenAlert,{picker=true},{prep=true});"manager"->StoreTools(openWeb,{picker=true},{prep=true});else->RolePicker(role,{role=it;saveRole(it);picker=false},false){}}
}

@Composable private fun RolePicker(current:String,onPick:(String)->Unit,dismissible:Boolean,onDismiss:()->Unit){
    Surface(Modifier.fillMaxSize(),color=Ink){Box(Modifier.fillMaxSize().padding(28.dp)){Column(Modifier.fillMaxWidth().widthIn(max=780.dp).align(Alignment.Center)){
        Row(verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(44.dp).background(Gold,RoundedCornerShape(14.dp)),contentAlignment=Alignment.Center){Text("BBQ",fontWeight=FontWeight.Black,fontSize=12.sp)};Spacer(Modifier.width(14.dp));Column{Text("BBQ TOWN OPS",color=Color.White,fontWeight=FontWeight.Black,fontSize=24.sp);Text("Dickson · Native Operations",color=Color(0xFFB8C6BC),fontSize=13.sp)}}
        Spacer(Modifier.height(34.dp));Text("Set this device",color=Color.White,fontWeight=FontWeight.Black,fontSize=34.sp);Text("Choose one permanent workspace. Next time the app opens straight into it.",color=Color(0xFFB8C6BC),fontSize=15.sp);Spacer(Modifier.height(22.dp))
        Role.entries.forEach{r->val selected=current==r.key;Surface(Modifier.fillMaxWidth().padding(vertical=6.dp).clickable{onPick(r.key)},color=if(selected)Color(0xFF233C2A)else Color(0xFF202B22),shape=RoundedCornerShape(18.dp),border=androidx.compose.foundation.BorderStroke(1.dp,if(selected)Gold else Color(0xFF344139))){Row(Modifier.padding(20.dp),verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(10.dp).background(if(selected)Gold else Color(0xFF65736A),CircleShape));Spacer(Modifier.width(16.dp));Column(Modifier.weight(1f)){Text(r.title,color=Color.White,fontWeight=FontWeight.ExtraBold,fontSize=18.sp);Text(r.sub,color=Color(0xFFB8C6BC),fontSize=13.sp)};Text("›",color=Gold,fontSize=30.sp)}}}
        if(dismissible){TextButton(onClick=onDismiss,modifier=Modifier.align(Alignment.End)){Text("Cancel",color=Color.White)}}
    }}}
}

@Composable private fun AppHeader(title:String,subtitle:String,onDevice:()->Unit,trailing:@Composable RowScope.()->Unit={}){Surface(color=Ink){Row(Modifier.fillMaxWidth().padding(horizontal=22.dp,vertical=16.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text(title,color=Color.White,fontWeight=FontWeight.Black,fontSize=23.sp);Text(subtitle,color=Color(0xFFB8C6BC),fontSize=12.sp)};trailing();Spacer(Modifier.width(8.dp));TextButton(onClick=onDevice){Text("DEVICE",color=Color.White,fontWeight=FontWeight.Bold,fontSize=11.sp)}}}}

@Composable private fun rememberLive(api:OpsApi):Triple<Snapshot?,Boolean,String?>{var s by remember{mutableStateOf<Snapshot?>(null)};var loading by remember{mutableStateOf(true)};var err by remember{mutableStateOf<String?>(null)};LaunchedEffect(Unit){while(true){try{s=api.loadLive();err=null}catch(e:Exception){err=e.message?:"Connection error"};loading=false;delay(3500)}};return Triple(s,loading,err)}

@Composable private fun StatusSummary(foods:List<FoodItem>){Row(Modifier.fillMaxWidth().padding(horizontal=20.dp,vertical=14.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){SummaryTile("GOOD",foods.count{it.status=="GOOD"},Green,Modifier.weight(1f));SummaryTile("LOW",foods.count{it.status=="LOW"},Gold,Modifier.weight(1f));SummaryTile("EMPTY",foods.count{it.status=="EMPTY"},Red,Modifier.weight(1f));SummaryTile("KITCHEN",foods.count{it.kitchen!="idle"},Slate,Modifier.weight(1f))}}
@Composable private fun SummaryTile(label:String,value:Int,accent:Color,modifier:Modifier){Surface(modifier,color=Color.White,shape=RoundedCornerShape(15.dp),border=androidx.compose.foundation.BorderStroke(1.dp,Line)){Column(Modifier.padding(14.dp)){Text(value.toString(),fontSize=26.sp,fontWeight=FontWeight.Black);Row(verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(7.dp).background(accent,CircleShape));Spacer(Modifier.width(6.dp));Text(label,fontSize=9.sp,fontWeight=FontWeight.Black,color=Muted)}}}}

@Composable private fun FohScreen(api:OpsApi,onDevice:()->Unit,onPrep:()->Unit){
    val(scope)=arrayOf(rememberCoroutineScope());val(live,loading,error)=rememberLive(api);var local by remember{mutableStateOf<Snapshot?>(null)};var category by remember{mutableStateOf("ALL")};var busy by remember{mutableStateOf<Int?>(null)};var actionError by remember{mutableStateOf<String?>(null)}
    LaunchedEffect(live?.updatedAt){if(live!=null)local=live};val foods=local?.foods?:emptyList();val cats=listOf("ALL")+foods.map{it.category}.distinct()
    Column(Modifier.fillMaxSize().background(Canvas)){AppHeader("FOH FLOOR","One tap to notify the right kitchen",onDevice){TextButton(onClick=onPrep){Text("PREP",color=Gold,fontWeight=FontWeight.Black)}};if(loading&&foods.isEmpty())LinearProgressIndicator(Modifier.fillMaxWidth(),color=Gold);(error?:actionError)?.let{ErrorBanner(it)};StatusSummary(foods)
        Row(Modifier.fillMaxWidth().padding(horizontal=20.dp),horizontalArrangement=Arrangement.spacedBy(8.dp)){cats.take(5).forEach{c->FilterChip(selected=category==c,onClick={category=c},label={Text(c,fontSize=11.sp,fontWeight=FontWeight.Bold)})}}
        val priority=foods.count{it.status=="EMPTY"||it.kitchen=="ready"};if(priority>0)Surface(Modifier.fillMaxWidth().padding(20.dp,10.dp),color=GoldSoft,shape=RoundedCornerShape(16.dp)){Row(Modifier.padding(16.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text("PRIORITY NOW",fontWeight=FontWeight.Black);Text("$priority item${if(priority==1)""else"s"} need floor action",color=Muted,fontSize=12.sp)};Box(Modifier.size(34.dp).background(Gold,CircleShape),contentAlignment=Alignment.Center){Text(priority.toString(),fontWeight=FontWeight.Black)}}}
        LazyColumn(contentPadding=PaddingValues(horizontal=20.dp,vertical=6.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){items(foods.filter{category=="ALL"||it.category==category},key={it.id}){f->FoodFloorCard(f,busy==f.id){spec->busy=f.id;scope[0].launch{try{local=api.action(local,spec,f.id);actionError=null}catch(e:Exception){actionError=e.message};busy=null}}};item{Spacer(Modifier.height(20.dp))}}
    }
}

@Composable private fun FoodFloorCard(food:FoodItem,busy:Boolean,onAction:(String)->Unit){val accent=when(food.status){"LOW"->Gold;"EMPTY"->Red;else->Green};Surface(color=Color.White,shape=RoundedCornerShape(16.dp),border=androidx.compose.foundation.BorderStroke(1.dp,Line)){Column(Modifier.padding(16.dp)){Row(verticalAlignment=Alignment.Top){Column(Modifier.weight(1f)){Text(food.name,fontWeight=FontWeight.ExtraBold,fontSize=17.sp,maxLines=2,overflow=TextOverflow.Ellipsis);Text("${food.category} · Section ${food.section}",color=Muted,fontSize=11.sp)};StatusPill(food.status,accent)};Spacer(Modifier.height(11.dp));if(food.kitchen=="ready")Button(onClick={onAction("refilled")},enabled=!busy,modifier=Modifier.fillMaxWidth().height(50.dp),colors=ButtonDefaults.buttonColors(containerColor=Green),shape=RoundedCornerShape(12.dp)){Text("REFILLED · START NEW BATCH",fontWeight=FontWeight.Black)}else Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){StateButton("GOOD",Green,GreenSoft,food.status=="GOOD",!busy,Modifier.weight(1f)){onAction("status:GOOD")};StateButton("LOW",Gold,GoldSoft,food.status=="LOW",!busy,Modifier.weight(1f)){onAction("status:LOW")};StateButton("EMPTY",Red,RedSoft,food.status=="EMPTY",!busy,Modifier.weight(1f)){onAction("status:EMPTY")}}}}}
@Composable private fun StateButton(label:String,color:Color,soft:Color,selected:Boolean,enabled:Boolean,modifier:Modifier,onClick:()->Unit){Surface(modifier.height(50.dp).clickable(enabled=enabled,onClick=onClick),color=if(selected)color else soft,shape=RoundedCornerShape(12.dp),border=androidx.compose.foundation.BorderStroke(1.dp,color.copy(alpha=.35f))){Box(contentAlignment=Alignment.Center){Text(label,color=if(selected)Color.White else color,fontWeight=FontWeight.Black,fontSize=12.sp)}}}
@Composable private fun StatusPill(text:String,color:Color){Surface(color=color.copy(alpha=.12f),shape=RoundedCornerShape(999.dp)){Text(text,color=color,fontWeight=FontWeight.Black,fontSize=10.sp,modifier=Modifier.padding(horizontal=10.dp,vertical=6.dp))}}

@Composable private fun KitchenScreen(api:OpsApi,section:Int,kitchenAlert:()->Unit,onDevice:()->Unit,onPrep:()->Unit){
    val scope=rememberCoroutineScope();val(live,loading,error)=rememberLive(api);var local by remember{mutableStateOf<Snapshot?>(null)};var oldNew by remember{mutableIntStateOf(-1)};var busy by remember{mutableStateOf<Int?>(null)};var actionError by remember{mutableStateOf<String?>(null)};LaunchedEffect(live?.updatedAt){if(live!=null)local=live};val tasks=(local?.foods?:emptyList()).filter{it.section==section&&it.kitchen!="idle"};val newCount=tasks.count{it.kitchen=="requested"};LaunchedEffect(newCount){if(oldNew>=0&&newCount>oldNew)kitchenAlert();oldNew=newCount}
    Column(Modifier.fillMaxSize().background(Ink)){AppHeader("KITCHEN $section",if(section==1)"Hot food · meat · seafood" else "Vegetables · sides · dessert",onDevice){Button(onClick=onPrep,colors=ButtonDefaults.buttonColors(containerColor=Gold),shape=RoundedCornerShape(12.dp)){Text("TOMORROW PREP",color=Ink,fontWeight=FontWeight.Black,fontSize=11.sp)}};if(loading&&tasks.isEmpty())LinearProgressIndicator(Modifier.fillMaxWidth(),color=Gold);(error?:actionError)?.let{ErrorBanner(it)}
        Row(Modifier.fillMaxWidth().padding(20.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){DarkMetric("NEW",tasks.count{it.kitchen=="requested"},Gold,Modifier.weight(1f));DarkMetric("PREPARING",tasks.count{it.kitchen=="preparing"},Color(0xFF8AA2FF),Modifier.weight(1f));DarkMetric("READY",tasks.count{it.kitchen=="ready"},Green,Modifier.weight(1f))}
        if(tasks.isEmpty())Box(Modifier.fillMaxSize(),contentAlignment=Alignment.Center){Column(horizontalAlignment=Alignment.CenterHorizontally){Text("ALL CLEAR",color=Color.White,fontWeight=FontWeight.Black,fontSize=30.sp);Text("Waiting for floor requests",color=Color(0xFF9EACA2))}} else LazyColumn(contentPadding=PaddingValues(horizontal=20.dp,vertical=4.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){items(tasks.sortedWith(compareBy<FoodItem>({it.kitchen!="requested"},{it.status!="EMPTY"},{it.requestedAt})),key={it.id}){f->KitchenTaskCard(f,busy==f.id){spec->busy=f.id;scope.launch{try{local=api.action(local,spec,f.id);actionError=null}catch(e:Exception){actionError=e.message};busy=null}}};item{Spacer(Modifier.height(24.dp))}}
    }
}
@Composable private fun DarkMetric(label:String,value:Int,accent:Color,modifier:Modifier){Surface(modifier,color=Color(0xFF202B22),shape=RoundedCornerShape(15.dp),border=androidx.compose.foundation.BorderStroke(1.dp,Color(0xFF344139))){Column(Modifier.padding(14.dp)){Text(value.toString(),color=Color.White,fontSize=27.sp,fontWeight=FontWeight.Black);Text(label,color=accent,fontSize=9.sp,fontWeight=FontWeight.Black)}}}
@Composable private fun KitchenTaskCard(food:FoodItem,busy:Boolean,onAction:(String)->Unit){val urgent=food.status=="EMPTY";Surface(color=Color(0xFFFDFEFB),shape=RoundedCornerShape(18.dp),border=androidx.compose.foundation.BorderStroke(2.dp,if(urgent)Red else Gold)){Column(Modifier.padding(18.dp)){Row(verticalAlignment=Alignment.Top){Column(Modifier.weight(1f)){Text(food.name,fontWeight=FontWeight.Black,fontSize=22.sp);Text(if(urgent)"EMPTY · URGENT" else "LOW · PREP NEXT",color=if(urgent)Red else Gold,fontWeight=FontWeight.Black,fontSize=11.sp)};StatusPill(food.kitchen.uppercase(),when(food.kitchen){"ready"->Green;"preparing"->Color(0xFF526DD3);else->Gold})};Spacer(Modifier.height(14.dp));when(food.kitchen){"requested"->Button(onClick={onAction("kitchen_prepare")},enabled=!busy,modifier=Modifier.fillMaxWidth().height(58.dp),colors=ButtonDefaults.buttonColors(containerColor=Ink),shape=RoundedCornerShape(13.dp)){Text("START PREPARING",fontWeight=FontWeight.Black,fontSize=15.sp)};"preparing"->Button(onClick={onAction("kitchen_ready")},enabled=!busy,modifier=Modifier.fillMaxWidth().height(58.dp),colors=ButtonDefaults.buttonColors(containerColor=Green),shape=RoundedCornerShape(13.dp)){Text("MARK READY TO REFILL",fontWeight=FontWeight.Black,fontSize=15.sp)};else->Surface(color=GreenSoft,shape=RoundedCornerShape(13.dp)){Box(Modifier.fillMaxWidth().height(58.dp),contentAlignment=Alignment.Center){Text("✓ READY · WAITING FOR FOH",color=Green,fontWeight=FontWeight.Black)}}}}}}

@Composable private fun StoreTools(openWeb:(String)->Unit,onDevice:()->Unit,onPrep:()->Unit){Column(Modifier.fillMaxSize().background(Canvas)){AppHeader("STORE TOOLS","Only the essentials for daily operations",onDevice);Column(Modifier.fillMaxWidth().widthIn(max=900.dp).padding(22.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){Text("Daily tools",fontSize=30.sp,fontWeight=FontWeight.Black);Text("Operations are native. Tables, bookings and voucher verification intentionally stay on the web.",color=Muted,fontSize=13.sp);Spacer(Modifier.height(8.dp));ToolCard("TABLES","Seating and table status",Gold){openWeb("/tables.html")};ToolCard("BOOKINGS","View and manage reservations",Green){openWeb("/reservations.html")};ToolCard("VERIFY VOUCHER","Staff 10% voucher redemption",Color(0xFF526DD3)){openWeb("/vouchers")};ToolCard("KITCHEN PREP","Tomorrow prep list and completion",Ink){onPrep()}}}}
@Composable private fun ToolCard(title:String,subtitle:String,accent:Color,onClick:()->Unit){Surface(Modifier.fillMaxWidth().clickable(onClick=onClick),color=Color.White,shape=RoundedCornerShape(18.dp),border=androidx.compose.foundation.BorderStroke(1.dp,Line)){Row(Modifier.padding(20.dp),verticalAlignment=Alignment.CenterVertically){Box(Modifier.size(46.dp).background(accent.copy(alpha=.12f),RoundedCornerShape(14.dp)),contentAlignment=Alignment.Center){Box(Modifier.size(12.dp).background(accent,CircleShape))};Spacer(Modifier.width(16.dp));Column(Modifier.weight(1f)){Text(title,fontSize=18.sp,fontWeight=FontWeight.Black);Text(subtitle,color=Muted,fontSize=12.sp)};Text("›",color=accent,fontSize=32.sp)}}}

@Composable private fun PrepScreen(api:OpsApi,role:String,onBack:()->Unit){
    val scope=rememberCoroutineScope();val section=when(role){"s1"->"S1";"s2"->"S2";else->"ALL"};val date=remember{tomorrowSydney()};var list by remember{mutableStateOf<List<PrepItem>>(emptyList())};var loading by remember{mutableStateOf(true)};var err by remember{mutableStateOf<String?>(null)};var add by remember{mutableStateOf(false)}
    suspend fun refresh(){try{list=api.loadPrep(date,section);err=null}catch(e:Exception){err=e.message};loading=false};LaunchedEffect(date,section){refresh()}
    Column(Modifier.fillMaxSize().background(Canvas)){Surface(color=Ink){Row(Modifier.fillMaxWidth().padding(18.dp),verticalAlignment=Alignment.CenterVertically){TextButton(onClick=onBack){Text("‹ BACK",color=Color.White,fontWeight=FontWeight.Bold)};Spacer(Modifier.width(8.dp));Column(Modifier.weight(1f)){Text("TOMORROW PREP",color=Color.White,fontSize=22.sp,fontWeight=FontWeight.Black);Text(date,color=Color(0xFFB8C6BC),fontSize=12.sp)};Button(onClick={add=true},colors=ButtonDefaults.buttonColors(containerColor=Gold),shape=RoundedCornerShape(12.dp)){Text("+ ADD",color=Ink,fontWeight=FontWeight.Black)}}};if(loading)LinearProgressIndicator(Modifier.fillMaxWidth(),color=Gold);err?.let{ErrorBanner(it)};val done=list.count{it.completed};Row(Modifier.fillMaxWidth().padding(20.dp),verticalAlignment=Alignment.CenterVertically){Column(Modifier.weight(1f)){Text("Prep progress",fontWeight=FontWeight.Black,fontSize=18.sp);Text("$done of ${list.size} complete",color=Muted,fontSize=12.sp)};Text(if(list.isEmpty())"—" else "${done*100/list.size}%",fontSize=28.sp,fontWeight=FontWeight.Black,color=if(done==list.size&&list.isNotEmpty())Green else Ink)}
        LazyColumn(contentPadding=PaddingValues(horizontal=20.dp,vertical=2.dp),verticalArrangement=Arrangement.spacedBy(9.dp)){items(list,key={it.id}){x->Surface(color=if(x.completed)GreenSoft else Color.White,shape=RoundedCornerShape(16.dp),border=androidx.compose.foundation.BorderStroke(1.dp,if(x.completed)Green.copy(alpha=.25f) else Line)){Row(Modifier.fillMaxWidth().clickable{scope.launch{try{api.togglePrep(x.id,!x.completed);refresh()}catch(e:Exception){err=e.message}}}.padding(16.dp),verticalAlignment=Alignment.CenterVertically){Checkbox(x.completed,null,colors=CheckboxDefaults.colors(checkedColor=Green));Spacer(Modifier.width(10.dp));Column(Modifier.weight(1f)){Text(x.item,fontWeight=FontWeight.ExtraBold,fontSize=16.sp,color=if(x.completed)Green else Ink);val meta=listOf(x.quantity,x.section,x.notes).filter{it.isNotBlank()}.joinToString(" · ");if(meta.isNotBlank())Text(meta,color=Muted,fontSize=11.sp)};if(x.completed)Text("DONE",color=Green,fontWeight=FontWeight.Black,fontSize=10.sp)}}};if(list.isEmpty()&&!loading)item{Box(Modifier.fillParentMaxWidth().height(180.dp),contentAlignment=Alignment.Center){Text("No prep items yet",color=Muted)}}}
    }
    if(add)AddPrepDialog(date,role,{add=false}){item,qty,notes,sec->scope.launch{try{api.addPrep(date,item,qty,notes,sec);add=false;refresh()}catch(e:Exception){err=e.message}}}
}
@Composable private fun AddPrepDialog(date:String,role:String,onDismiss:()->Unit,onSave:(String,String,String,String)->Unit){var item by remember{mutableStateOf("")};var qty by remember{mutableStateOf("")};var notes by remember{mutableStateOf("")};val sec=when(role){"s1"->"S1";"s2"->"S2";else->"ALL"};AlertDialog(onDismissRequest=onDismiss,title={Text("Add prep item",fontWeight=FontWeight.Black)},text={Column(verticalArrangement=Arrangement.spacedBy(10.dp)){OutlinedTextField(item,{item=it},label={Text("Item")},singleLine=true,modifier=Modifier.fillMaxWidth());OutlinedTextField(qty,{qty=it},label={Text("Quantity · 3 trays / 5kg")},singleLine=true,modifier=Modifier.fillMaxWidth());OutlinedTextField(notes,{notes=it},label={Text("Notes")},modifier=Modifier.fillMaxWidth());Text("$date · $sec",color=Muted,fontSize=11.sp)}},confirmButton={Button(onClick={if(item.isNotBlank())onSave(item,qty,notes,sec)},colors=ButtonDefaults.buttonColors(containerColor=Ink)){Text("ADD PREP")}},dismissButton={TextButton(onClick=onDismiss){Text("Cancel")}})}
@Composable private fun ErrorBanner(text:String){Surface(Modifier.fillMaxWidth(),color=RedSoft){Text(text,color=Red,fontWeight=FontWeight.Bold,fontSize=12.sp,modifier=Modifier.padding(12.dp))}}

private data class FoodItem(val id:Int,val name:String,val category:String,val section:Int,val status:String,val kitchen:String,val start:Long,val requestedAt:Long)
private data class Snapshot(val foods:List<FoodItem>,val updatedAt:Long)
private data class PrepItem(val id:Long,val section:String,val item:String,val quantity:String,val notes:String,val completed:Boolean)

private class OpsApi{
    private val base="https://bbqtowndickson.com";private val ua="BBQTownOpsAndroid/2.0 Native"
    suspend fun loadLive():Snapshot=withContext(Dispatchers.IO){val(c,t)=request("GET","/api/ops/live",null);if(c !in 200..299)throw Exception("Unable to sync operations");parseSnapshot(JSONObject(t))}
    suspend fun action(snapshot:Snapshot?,spec:String,id:Int):Snapshot=withContext(Dispatchers.IO){val b=JSONObject().put("expectedUpdatedAt",snapshot?.updatedAt?:0);if(spec.startsWith("status:"))b.put("action","status").put("status",spec.substringAfter(':')).put("id",id)else b.put("action",spec).put("id",id);postLive(b)}
    private fun postLive(body:JSONObject):Snapshot{var(c,t)=request("POST","/api/ops/live",body.toString());if(c==409){val conflict=JSONObject(t);body.put("expectedUpdatedAt",conflict.optLong("updatedAt",0));val again=request("POST","/api/ops/live",body.toString());c=again.first;t=again.second};if(c !in 200..299)throw Exception(runCatching{JSONObject(t).optString("error","Action failed")}.getOrDefault("Action failed"));return parseSnapshot(JSONObject(t))}
    suspend fun loadPrep(date:String,section:String):List<PrepItem>=withContext(Dispatchers.IO){val(c,t)=request("GET","/api/ops/prep?date=${Uri.encode(date)}&section=${Uri.encode(section)}",null);if(c !in 200..299)throw Exception("Unable to load prep");parsePrep(JSONObject(t))}
    suspend fun togglePrep(id:Long,completed:Boolean)=withContext(Dispatchers.IO){postPrep(JSONObject().put("action","toggle").put("id",id).put("completed",completed).put("completedBy","Kitchen"))}
    suspend fun addPrep(date:String,item:String,qty:String,notes:String,section:String)=withContext(Dispatchers.IO){postPrep(JSONObject().put("action","add").put("prepDate",date).put("item",item).put("quantity",qty).put("notes",notes).put("section",section).put("createdBy","Kitchen"))}
    private fun postPrep(b:JSONObject){val(c,t)=request("POST","/api/ops/prep",b.toString());if(c !in 200..299)throw Exception(runCatching{JSONObject(t).optString("error","Save failed")}.getOrDefault("Save failed"))}
    private fun request(method:String,path:String,body:String?):Pair<Int,String>{val c=(URL(base+path).openConnection() as HttpURLConnection).apply{requestMethod=method;connectTimeout=7000;readTimeout=7000;setRequestProperty("User-Agent",ua);setRequestProperty("Accept","application/json");if(body!=null){doOutput=true;setRequestProperty("Content-Type","application/json");outputStream.use{it.write(body.toByteArray())}}};val code=c.responseCode;val stream=if(code in 200..299)c.inputStream else c.errorStream;val text=stream?.bufferedReader()?.use{it.readText()}.orEmpty();c.disconnect();return code to text}
    private fun parseSnapshot(root:JSONObject):Snapshot{val state=root.optJSONObject("state")?:JSONObject();val a=state.optJSONArray("foods")?:JSONArray();val foods=buildList{for(i in 0 until a.length()){val f=a.optJSONObject(i)?:continue;add(FoodItem(f.optInt("id"),f.optString("name","Dish"),f.optString("category","Other"),f.optInt("section",1),f.optString("status","GOOD"),f.optString("kitchen","idle"),f.optLong("start",0),f.optLong("requestedAt",0)))}};return Snapshot(foods,root.optLong("updatedAt",0))}
    private fun parsePrep(root:JSONObject):List<PrepItem>{val a=root.optJSONArray("items")?:JSONArray();return buildList{for(i in 0 until a.length()){val x=a.optJSONObject(i)?:continue;add(PrepItem(x.optLong("id"),x.optString("section"),x.optString("item"),x.optString("quantity"),x.optString("notes"),x.optBoolean("completed")))}}}
}
private fun tomorrowSydney():String{val cal=Calendar.getInstance(TimeZone.getTimeZone("Australia/Sydney"));cal.add(Calendar.DAY_OF_MONTH,1);return SimpleDateFormat("yyyy-MM-dd",Locale.US).apply{timeZone=TimeZone.getTimeZone("Australia/Sydney")}.format(cal.time)}
