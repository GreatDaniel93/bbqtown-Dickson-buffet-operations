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
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

private val NInk = Color(0xFF142018)
private val NCanvas = Color(0xFFF6F4EE)
private val NLine = Color(0xFFE2E7E1)
private val NMuted = Color(0xFF69736C)
private val NGreen = Color(0xFF267548)
private val NGreenSoft = Color(0xFFE7F4EA)
private val NGold = Color(0xFFC58818)
private val NGoldSoft = Color(0xFFFFF0D3)
private val NRed = Color(0xFFB82D2D)
private val NRedSoft = Color(0xFFFFE8E5)
private val NBlue = Color(0xFF536FD3)
private val NBlueSoft = Color(0xFFE9EDFF)
private val NDarkCard = Color(0xFF202C23)
private val NClosed = Color(0xFF7B837D)

class NativeOpsActivity : ComponentActivity() {
    private lateinit var prefs: android.content.SharedPreferences
    private var tone: ToneGenerator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        prefs = getSharedPreferences("bbqtown_ops_v2", Context.MODE_PRIVATE)
        setContent {
            NativeTheme {
                NativeRoot(
                    initialRole = prefs.getString("role", "").orEmpty(),
                    saveRole = { prefs.edit().putString("role", it).apply() },
                    openWeb = { path -> startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://bbqtowndickson.com$path"))) },
                    alertKitchen = { kitchenAlert() }
                )
            }
        }
    }

    private fun kitchenAlert() {
        try {
            if (tone == null) tone = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            tone?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 600)
        } catch (_: Exception) {}
        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val pattern = longArrayOf(0, 180, 80, 180)
            if (android.os.Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        tone?.release()
        tone = null
        super.onDestroy()
    }
}

@Composable
private fun NativeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = NInk,
            secondary = NGold,
            background = NCanvas,
            surface = Color.White,
            onSurface = NInk,
            outline = NLine
        ),
        content = content
    )
}

private enum class NRole(val key: String, val title: String, val subtitle: String) {
    FOH("foh", "FOH FLOOR", "Buffet status · opening · closing"),
    K1("s1", "KITCHEN 1", "Section 1 production"),
    K2("s2", "KITCHEN 2", "Section 2 production"),
    MANAGER("manager", "STORE TOOLS", "Daily controls and dish setup")
}

@Composable
private fun NativeRoot(
    initialRole: String,
    saveRole: (String) -> Unit,
    openWeb: (String) -> Unit,
    alertKitchen: () -> Unit
) {
    val api = remember { NativeOpsApi() }
    var role by remember { mutableStateOf(initialRole) }
    var page by remember { mutableStateOf(if (role.isBlank()) "role" else "home") }

    when (page) {
        "role" -> NRolePicker(role, onPick = {
            role = it
            saveRole(it)
            page = "home"
        }, onCancel = if (role.isBlank()) null else {{ page = "home" }})
        "prep" -> NPrepScreen(api, role) { page = "home" }
        "dishes" -> NDishManager(api) { page = "home" }
        else -> when (role) {
            "foh" -> NFohScreen(api, onDevice = { page = "role" }, onPrep = { page = "prep" })
            "s1" -> NKitchenScreen(api, 1, alertKitchen, onDevice = { page = "role" }, onPrep = { page = "prep" })
            "s2" -> NKitchenScreen(api, 2, alertKitchen, onDevice = { page = "role" }, onPrep = { page = "prep" })
            "manager" -> NStoreTools(openWeb, onDevice = { page = "role" }, onPrep = { page = "prep" }, onDishes = { page = "dishes" })
            else -> page = "role"
        }
    }
}

@Composable
private fun NRolePicker(current: String, onPick: (String) -> Unit, onCancel: (() -> Unit)?) {
    Surface(Modifier.fillMaxSize(), color = NInk) {
        Box(Modifier.fillMaxSize().padding(28.dp)) {
            Column(Modifier.fillMaxWidth().widthIn(max = 820.dp).align(Alignment.Center)) {
                Text("BBQ TOWN", color = NGold, fontWeight = FontWeight.Black, fontSize = 13.sp)
                Text("OPERATIONS", color = Color.White, fontWeight = FontWeight.Black, fontSize = 34.sp)
                Text("Set this tablet to one workspace", color = Color(0xFFB9C5BC), fontSize = 14.sp)
                Spacer(Modifier.height(26.dp))
                NRole.entries.forEach { item ->
                    val selected = item.key == current
                    Surface(
                        Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable { onPick(item.key) },
                        color = if (selected) Color(0xFF263B2B) else NDarkCard,
                        shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, if (selected) NGold else Color(0xFF344139))
                    ) {
                        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(11.dp).background(if (selected) NGold else Color(0xFF6A756D), CircleShape))
                            Spacer(Modifier.width(15.dp))
                            Column(Modifier.weight(1f)) {
                                Text(item.title, color = Color.White, fontWeight = FontWeight.Black, fontSize = 19.sp)
                                Text(item.subtitle, color = Color(0xFFB9C5BC), fontSize = 12.sp)
                            }
                            Text("›", color = NGold, fontSize = 30.sp)
                        }
                    }
                }
                if (onCancel != null) TextButton(onClick = onCancel, modifier = Modifier.align(Alignment.End)) { Text("CANCEL", color = Color.White) }
            }
        }
    }
}

@Composable
private fun NHeader(title: String, subtitle: String, onDevice: () -> Unit, trailing: @Composable RowScope.() -> Unit = {}) {
    Surface(color = NInk) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 15.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Black)
                Text(subtitle, color = Color(0xFFB9C5BC), fontSize = 11.sp)
            }
            trailing()
            Spacer(Modifier.width(6.dp))
            TextButton(onClick = onDevice) { Text("DEVICE", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Black) }
        }
    }
}

@Composable
private fun NFohScreen(api: NativeOpsApi, onDevice: () -> Unit, onPrep: () -> Unit) {
    val scope = rememberCoroutineScope()
    var snapshot by remember { mutableStateOf<NSnapshot?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var category by remember { mutableStateOf("ALL") }
    var pending by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        while (true) {
            if (pending == 0) {
                try {
                    val fresh = api.loadLive()
                    if (snapshot == null || fresh.updatedAt >= (snapshot?.updatedAt ?: 0)) snapshot = fresh
                    error = null
                } catch (e: Exception) { error = e.message }
                loading = false
            }
            delay(8000)
        }
    }

    fun runAction(spec: String, id: Int = 0) {
        val base = snapshot
        snapshot = optimistic(base, spec, id)
        pending += 1
        scope.launch {
            try {
                snapshot = api.action(base, spec, id)
                error = null
            } catch (e: Exception) {
                error = e.message
                try { snapshot = api.loadLive() } catch (_: Exception) {}
            }
            pending -= 1
        }
    }

    val foods = snapshot?.foods ?: emptyList()
    val categories = listOf("ALL") + foods.map { it.category }.distinct()

    Column(Modifier.fillMaxSize().background(NCanvas)) {
        NHeader("FOH FLOOR", "Tap first. Sync happens quietly in the background.", onDevice) {
            TextButton(onClick = onPrep) { Text("PREP", color = NGold, fontWeight = FontWeight.Black) }
        }
        if (loading && foods.isEmpty()) LinearProgressIndicator(Modifier.fillMaxWidth(), color = NGold)
        error?.let { NError(it) }

        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NBigAction("OPEN ALL", "Start every dish", NGreen, Modifier.weight(1f)) { runAction("start_all") }
            NBigAction("CLOSE ALL", "End service", NRed, Modifier.weight(1f)) { runAction("close_all") }
        }

        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NMetric("GOOD", foods.count { it.status == "GOOD" }, NGreen, Modifier.weight(1f))
            NMetric("LOW", foods.count { it.status == "LOW" }, NGold, Modifier.weight(1f))
            NMetric("EMPTY", foods.count { it.status == "EMPTY" }, NRed, Modifier.weight(1f))
            NMetric("CLOSED", foods.count { it.status == "CLOSED" }, NClosed, Modifier.weight(1f))
        }

        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(categories) { c ->
                FilterChip(selected = c == category, onClick = { category = c }, label = { Text(c, fontSize = 10.sp, fontWeight = FontWeight.Bold) })
            }
        }

        LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 2.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            items(foods.filter { category == "ALL" || it.category == category }, key = { it.id }) { food ->
                NFoodCard(food) { runAction(it, food.id) }
            }
            item { Spacer(Modifier.height(22.dp)) }
        }
    }
}

@Composable
private fun NBigAction(title: String, subtitle: String, color: Color, modifier: Modifier, onClick: () -> Unit) {
    Surface(modifier.clickable(onClick = onClick), color = color, shape = RoundedCornerShape(17.dp)) {
        Column(Modifier.padding(17.dp)) {
            Text(title, color = Color.White, fontWeight = FontWeight.Black, fontSize = 16.sp)
            Text(subtitle, color = Color.White.copy(alpha = .8f), fontSize = 10.sp)
        }
    }
}

@Composable
private fun NMetric(label: String, value: Int, color: Color, modifier: Modifier) {
    Surface(modifier, color = Color.White, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, NLine)) {
        Column(Modifier.padding(12.dp)) {
            Text(value.toString(), fontWeight = FontWeight.Black, fontSize = 24.sp)
            Text(label, color = color, fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun NFoodCard(food: NFood, onAction: (String) -> Unit) {
    val statusColor = when (food.status) {
        "LOW" -> NGold
        "EMPTY" -> NRed
        "CLOSED" -> NClosed
        else -> NGreen
    }
    Surface(color = Color.White, shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, NLine)) {
        Column(Modifier.padding(15.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(food.name, fontSize = 17.sp, fontWeight = FontWeight.Black, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text("${food.category} · Kitchen ${food.section}", color = NMuted, fontSize = 10.sp)
                }
                NStatus(food.status, statusColor)
            }
            Spacer(Modifier.height(10.dp))
            if (food.kitchen == "ready") {
                Button(onClick = { onAction("refilled") }, modifier = Modifier.fillMaxWidth().height(48.dp), colors = ButtonDefaults.buttonColors(containerColor = NGreen), shape = RoundedCornerShape(12.dp)) {
                    Text("REFILLED · GOOD", fontWeight = FontWeight.Black)
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    NState("GOOD", NGreen, NGreenSoft, food.status == "GOOD", Modifier.weight(1f)) { onAction("status:GOOD") }
                    NState("LOW", NGold, NGoldSoft, food.status == "LOW", Modifier.weight(1f)) { onAction("status:LOW") }
                    NState("EMPTY", NRed, NRedSoft, food.status == "EMPTY", Modifier.weight(1f)) { onAction("status:EMPTY") }
                }
            }
        }
    }
}

@Composable
private fun NState(label: String, color: Color, soft: Color, active: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Surface(modifier.height(48.dp).clickable(onClick = onClick), color = if (active) color else soft, shape = RoundedCornerShape(11.dp)) {
        Box(contentAlignment = Alignment.Center) { Text(label, color = if (active) Color.White else color, fontWeight = FontWeight.Black, fontSize = 11.sp) }
    }
}

@Composable
private fun NStatus(text: String, color: Color) {
    Surface(color = color.copy(alpha = .13f), shape = RoundedCornerShape(99.dp)) {
        Text(text, color = color, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
    }
}

@Composable
private fun NKitchenScreen(api: NativeOpsApi, section: Int, alertKitchen: () -> Unit, onDevice: () -> Unit, onPrep: () -> Unit) {
    val scope = rememberCoroutineScope()
    var snapshot by remember { mutableStateOf<NSnapshot?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var pending by remember { mutableIntStateOf(0) }
    var priorNew by remember { mutableIntStateOf(-1) }

    LaunchedEffect(Unit) {
        while (true) {
            if (pending == 0) {
                try {
                    val fresh = api.loadLive()
                    snapshot = fresh
                    error = null
                } catch (e: Exception) { error = e.message }
                loading = false
            }
            delay(5000)
        }
    }

    val tasks = (snapshot?.foods ?: emptyList()).filter { it.section == section && it.kitchen != "idle" }
    val newCount = tasks.count { it.kitchen == "requested" }
    LaunchedEffect(newCount) {
        if (priorNew >= 0 && newCount > priorNew) alertKitchen()
        priorNew = newCount
    }

    fun runAction(spec: String, id: Int) {
        val base = snapshot
        snapshot = optimistic(base, spec, id)
        pending += 1
        scope.launch {
            try { snapshot = api.action(base, spec, id); error = null }
            catch (e: Exception) { error = e.message; try { snapshot = api.loadLive() } catch (_: Exception) {} }
            pending -= 1
        }
    }

    Column(Modifier.fillMaxSize().background(NInk)) {
        NHeader("KITCHEN $section", if (section == 1) "Production queue · Section 1" else "Production queue · Section 2", onDevice) {
            Button(onClick = onPrep, colors = ButtonDefaults.buttonColors(containerColor = NGold), shape = RoundedCornerShape(11.dp)) { Text("PREP", color = NInk, fontWeight = FontWeight.Black, fontSize = 10.sp) }
        }
        if (loading && tasks.isEmpty()) LinearProgressIndicator(Modifier.fillMaxWidth(), color = NGold)
        error?.let { NError(it) }
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NDarkMetric("NEW", tasks.count { it.kitchen == "requested" }, NGold, Modifier.weight(1f))
            NDarkMetric("PREPARING", tasks.count { it.kitchen == "preparing" }, NBlue, Modifier.weight(1f))
            NDarkMetric("READY", tasks.count { it.kitchen == "ready" }, NGreen, Modifier.weight(1f))
        }
        if (tasks.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("ALL CLEAR", color = Color.White, fontWeight = FontWeight.Black, fontSize = 31.sp)
                    Text("Waiting for floor requests", color = Color(0xFFA7B3AA), fontSize = 12.sp)
                }
            }
        } else {
            LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(tasks.sortedWith(compareBy<NFood>({ it.kitchen != "requested" }, { it.status != "EMPTY" }, { it.requestedAt })), key = { it.id }) { food ->
                    NKitchenCard(food) { runAction(it, food.id) }
                }
                item { Spacer(Modifier.height(22.dp)) }
            }
        }
    }
}

@Composable
private fun NDarkMetric(label: String, value: Int, color: Color, modifier: Modifier) {
    Surface(modifier, color = NDarkCard, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, Color(0xFF344139))) {
        Column(Modifier.padding(13.dp)) {
            Text(value.toString(), color = Color.White, fontSize = 25.sp, fontWeight = FontWeight.Black)
            Text(label, color = color, fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun NKitchenCard(food: NFood, onAction: (String) -> Unit) {
    val urgent = food.status == "EMPTY"
    Surface(color = Color.White, shape = RoundedCornerShape(17.dp), border = BorderStroke(2.dp, if (urgent) NRed else NGold)) {
        Column(Modifier.padding(17.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(food.name, fontWeight = FontWeight.Black, fontSize = 22.sp)
                    Text(if (urgent) "EMPTY · URGENT" else "LOW · PREP NEXT", color = if (urgent) NRed else NGold, fontSize = 10.sp, fontWeight = FontWeight.Black)
                }
                NStatus(food.kitchen.uppercase(), when (food.kitchen) { "preparing" -> NBlue; "ready" -> NGreen; else -> NGold })
            }
            Spacer(Modifier.height(14.dp))
            when (food.kitchen) {
                "requested" -> Button(onClick = { onAction("kitchen_prepare") }, modifier = Modifier.fillMaxWidth().height(58.dp), colors = ButtonDefaults.buttonColors(containerColor = NInk), shape = RoundedCornerShape(12.dp)) { Text("START PREPARING", fontWeight = FontWeight.Black, fontSize = 15.sp) }
                "preparing" -> Button(onClick = { onAction("kitchen_ready") }, modifier = Modifier.fillMaxWidth().height(58.dp), colors = ButtonDefaults.buttonColors(containerColor = NGreen), shape = RoundedCornerShape(12.dp)) { Text("MARK READY", fontWeight = FontWeight.Black, fontSize = 15.sp) }
                else -> Surface(color = NGreenSoft, shape = RoundedCornerShape(12.dp)) { Box(Modifier.fillMaxWidth().height(58.dp), contentAlignment = Alignment.Center) { Text("READY · WAITING FOR FOH", color = NGreen, fontWeight = FontWeight.Black) } }
            }
        }
    }
}

@Composable
private fun NStoreTools(openWeb: (String) -> Unit, onDevice: () -> Unit, onPrep: () -> Unit, onDishes: () -> Unit) {
    Column(Modifier.fillMaxSize().background(NCanvas)) {
        NHeader("STORE TOOLS", "Keep manager controls simple", onDevice)
        Column(Modifier.fillMaxWidth().widthIn(max = 900.dp).padding(20.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
            Text("Daily controls", fontWeight = FontWeight.Black, fontSize = 28.sp)
            NTool("DISH SETUP", "Add, rename, move or remove buffet dishes", NGold, onDishes)
            NTool("TABLES", "Seating and table status", NBlue) { openWeb("/tables.html") }
            NTool("BOOKINGS", "View and manage reservations", NGreen) { openWeb("/reservations.html") }
            NTool("VERIFY VOUCHER", "Staff voucher redemption", NBlue) { openWeb("/vouchers") }
            NTool("KITCHEN PREP", "Tomorrow prep list", NInk, onPrep)
        }
    }
}

@Composable
private fun NTool(title: String, subtitle: String, accent: Color, onClick: () -> Unit) {
    Surface(Modifier.fillMaxWidth().clickable(onClick = onClick), color = Color.White, shape = RoundedCornerShape(17.dp), border = BorderStroke(1.dp, NLine)) {
        Row(Modifier.padding(19.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).background(accent.copy(alpha = .12f), RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) { Box(Modifier.size(11.dp).background(accent, CircleShape)) }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) { Text(title, fontWeight = FontWeight.Black, fontSize = 17.sp); Text(subtitle, color = NMuted, fontSize = 11.sp) }
            Text("›", color = accent, fontSize = 31.sp)
        }
    }
}

@Composable
private fun NDishManager(api: NativeOpsApi, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    var snapshot by remember { mutableStateOf<NSnapshot?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var edit by remember { mutableStateOf<NFood?>(null) }
    var adding by remember { mutableStateOf(false) }

    suspend fun refresh() {
        try { snapshot = api.loadLive(); error = null } catch (e: Exception) { error = e.message }
        loading = false
    }
    LaunchedEffect(Unit) { refresh() }

    Column(Modifier.fillMaxSize().background(NCanvas)) {
        Surface(color = NInk) {
            Row(Modifier.fillMaxWidth().padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onBack) { Text("‹ BACK", color = Color.White, fontWeight = FontWeight.Black) }
                Column(Modifier.weight(1f)) { Text("DISH SETUP", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp); Text("${snapshot?.foods?.size ?: 0} active dishes", color = Color(0xFFB9C5BC), fontSize = 11.sp) }
                Button(onClick = { adding = true }, colors = ButtonDefaults.buttonColors(containerColor = NGold), shape = RoundedCornerShape(11.dp)) { Text("+ ADD", color = NInk, fontWeight = FontWeight.Black) }
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = NGold)
        error?.let { NError(it) }
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(snapshot?.foods ?: emptyList(), key = { it.id }) { food ->
                Surface(Modifier.fillMaxWidth().clickable { edit = food }, color = Color.White, shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, NLine)) {
                    Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) { Text(food.name, fontWeight = FontWeight.Black, fontSize = 16.sp); Text("${food.category} · Kitchen ${food.section}", color = NMuted, fontSize = 10.sp) }
                        Text("EDIT ›", color = NGold, fontWeight = FontWeight.Black, fontSize = 10.sp)
                    }
                }
            }
        }
    }

    if (adding) NDishDialog(null, onDismiss = { adding = false }, onSave = { name, category, section ->
        scope.launch {
            try { snapshot = api.addDish(snapshot, name, category, section); adding = false; error = null }
            catch (e: Exception) { error = e.message }
        }
    })

    edit?.let { food ->
        NDishDialog(food, onDismiss = { edit = null }, onSave = { name, category, section ->
            scope.launch {
                try { snapshot = api.updateDish(snapshot, food.id, name, category, section); edit = null; error = null }
                catch (e: Exception) { error = e.message }
            }
        }, onDelete = {
            scope.launch {
                try { snapshot = api.deleteDish(snapshot, food.id); edit = null; error = null }
                catch (e: Exception) { error = e.message }
            }
        })
    }
}

@Composable
private fun NDishDialog(food: NFood?, onDismiss: () -> Unit, onSave: (String, String, Int) -> Unit, onDelete: (() -> Unit)? = null) {
    var name by remember(food?.id) { mutableStateOf(food?.name.orEmpty()) }
    var category by remember(food?.id) { mutableStateOf(food?.category.orEmpty()) }
    var section by remember(food?.id) { mutableIntStateOf(food?.section ?: 1) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (food == null) "Add dish" else "Edit dish", fontWeight = FontWeight.Black) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Dish name") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(category, { category = it }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Text("Kitchen section", color = NMuted, fontSize = 11.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = section == 1, onClick = { section = 1 }, label = { Text("SECTION 1") })
                    FilterChip(selected = section == 2, onClick = { section = 2 }, label = { Text("SECTION 2") })
                }
                if (onDelete != null) TextButton(onClick = onDelete) { Text("REMOVE DISH", color = NRed, fontWeight = FontWeight.Black) }
            }
        },
        confirmButton = { Button(onClick = { if (name.isNotBlank()) onSave(name.trim(), category.trim().ifBlank { "Other" }, section) }, colors = ButtonDefaults.buttonColors(containerColor = NInk)) { Text("SAVE") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("CANCEL") } }
    )
}

@Composable
private fun NPrepScreen(api: NativeOpsApi, role: String, onBack: () -> Unit) {
    val scope = rememberCoroutineScope()
    val date = remember { tomorrowSydneyNative() }
    val section = when (role) { "s1" -> "S1"; "s2" -> "S2"; else -> "ALL" }
    var items by remember { mutableStateOf<List<NPrep>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var add by remember { mutableStateOf(false) }

    suspend fun refresh() {
        try { items = api.loadPrep(date, section); error = null } catch (e: Exception) { error = e.message }
        loading = false
    }
    LaunchedEffect(date, section) { refresh() }

    Column(Modifier.fillMaxSize().background(NCanvas)) {
        Surface(color = NInk) {
            Row(Modifier.fillMaxWidth().padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onBack) { Text("‹ BACK", color = Color.White, fontWeight = FontWeight.Black) }
                Column(Modifier.weight(1f)) { Text("TOMORROW PREP", color = Color.White, fontWeight = FontWeight.Black, fontSize = 21.sp); Text(date, color = Color(0xFFB9C5BC), fontSize = 11.sp) }
                Button(onClick = { add = true }, colors = ButtonDefaults.buttonColors(containerColor = NGold), shape = RoundedCornerShape(11.dp)) { Text("+ ADD", color = NInk, fontWeight = FontWeight.Black) }
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = NGold)
        error?.let { NError(it) }
        val done = items.count { it.completed }
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) { Text("Prep progress", fontWeight = FontWeight.Black, fontSize = 18.sp); Text("$done / ${items.size} complete", color = NMuted, fontSize = 11.sp) }
            Text(if (items.isEmpty()) "—" else "${done * 100 / items.size}%", fontWeight = FontWeight.Black, fontSize = 27.sp)
        }
        LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(items, key = { it.id }) { item ->
                Surface(color = if (item.completed) NGreenSoft else Color.White, shape = RoundedCornerShape(15.dp), border = BorderStroke(1.dp, NLine)) {
                    Row(Modifier.fillMaxWidth().clickable {
                        val previous = items
                        items = items.map { if (it.id == item.id) it.copy(completed = !it.completed) else it }
                        scope.launch {
                            try { api.togglePrep(item.id, !item.completed); error = null }
                            catch (e: Exception) { items = previous; error = e.message }
                        }
                    }.padding(15.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(item.completed, null, colors = CheckboxDefaults.colors(checkedColor = NGreen))
                        Spacer(Modifier.width(9.dp))
                        Column(Modifier.weight(1f)) {
                            Text(item.item, fontWeight = FontWeight.Black, fontSize = 16.sp, color = if (item.completed) NGreen else NInk)
                            val meta = listOf(item.quantity, item.section, item.notes).filter { it.isNotBlank() }.joinToString(" · ")
                            if (meta.isNotBlank()) Text(meta, color = NMuted, fontSize = 10.sp)
                        }
                    }
                }
            }
        }
    }

    if (add) NPrepDialog(date, section, onDismiss = { add = false }, onSave = { item, qty, notes ->
        scope.launch {
            try { api.addPrep(date, item, qty, notes, section); add = false; refresh() }
            catch (e: Exception) { error = e.message }
        }
    })
}

@Composable
private fun NPrepDialog(date: String, section: String, onDismiss: () -> Unit, onSave: (String, String, String) -> Unit) {
    var item by remember { mutableStateOf("") }
    var qty by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add prep item", fontWeight = FontWeight.Black) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
            OutlinedTextField(item, { item = it }, label = { Text("Item") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(qty, { qty = it }, label = { Text("Quantity") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(notes, { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth())
            Text("$date · $section", color = NMuted, fontSize = 10.sp)
        } },
        confirmButton = { Button(onClick = { if (item.isNotBlank()) onSave(item, qty, notes) }, colors = ButtonDefaults.buttonColors(containerColor = NInk)) { Text("ADD") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("CANCEL") } }
    )
}

@Composable
private fun NError(text: String) {
    Surface(Modifier.fillMaxWidth(), color = NRedSoft) { Text(text, color = NRed, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(10.dp)) }
}

private data class NFood(
    val id: Int,
    val name: String,
    val category: String,
    val section: Int,
    val status: String,
    val kitchen: String,
    val start: Long,
    val requestedAt: Long
)
private data class NSnapshot(val foods: List<NFood>, val updatedAt: Long)
private data class NPrep(val id: Long, val section: String, val item: String, val quantity: String, val notes: String, val completed: Boolean)

private fun optimistic(snapshot: NSnapshot?, spec: String, id: Int): NSnapshot? {
    if (snapshot == null) return null
    val now = System.currentTimeMillis()
    if (spec == "start_all") return snapshot.copy(foods = snapshot.foods.map { it.copy(status = "GOOD", kitchen = "idle", start = now, requestedAt = 0) })
    if (spec == "close_all") return snapshot.copy(foods = snapshot.foods.map { it.copy(status = "CLOSED", kitchen = "idle", requestedAt = 0) })
    return snapshot.copy(foods = snapshot.foods.map { food ->
        if (food.id != id) food else when {
            spec.startsWith("status:") -> {
                val next = spec.substringAfter(':')
                if (next == "LOW" || next == "EMPTY") food.copy(status = next, kitchen = if (food.kitchen == "idle") "requested" else food.kitchen, requestedAt = if (food.kitchen == "idle") now else food.requestedAt)
                else food.copy(status = "GOOD", kitchen = if (food.kitchen == "requested") "idle" else food.kitchen, requestedAt = if (food.kitchen == "requested") 0 else food.requestedAt)
            }
            spec == "kitchen_prepare" -> food.copy(kitchen = "preparing")
            spec == "kitchen_ready" -> food.copy(kitchen = "ready")
            spec == "refilled" -> food.copy(status = "GOOD", kitchen = "idle", start = now, requestedAt = 0)
            else -> food
        }
    })
}

private class NativeOpsApi {
    private val base = "https://bbqtowndickson.com"
    private val ua = "BBQTownOpsAndroid/2.0 NativeFast"

    suspend fun loadLive(): NSnapshot = withContext(Dispatchers.IO) {
        val (code, text) = request("GET", "/api/ops/live", null)
        if (code !in 200..299) throw Exception("Unable to sync operations")
        parseSnapshot(JSONObject(text))
    }

    suspend fun action(snapshot: NSnapshot?, spec: String, id: Int): NSnapshot = withContext(Dispatchers.IO) {
        val body = JSONObject().put("expectedUpdatedAt", snapshot?.updatedAt ?: 0).put("action", if (spec.startsWith("status:")) "status" else spec)
        if (id > 0) body.put("id", id)
        if (spec.startsWith("status:")) body.put("status", spec.substringAfter(':'))
        postLive(body)
    }

    suspend fun addDish(snapshot: NSnapshot?, name: String, category: String, section: Int): NSnapshot = withContext(Dispatchers.IO) {
        postLive(JSONObject().put("expectedUpdatedAt", snapshot?.updatedAt ?: 0).put("action", "dish_add").put("name", name).put("category", category).put("section", section))
    }

    suspend fun updateDish(snapshot: NSnapshot?, id: Int, name: String, category: String, section: Int): NSnapshot = withContext(Dispatchers.IO) {
        postLive(JSONObject().put("expectedUpdatedAt", snapshot?.updatedAt ?: 0).put("action", "dish_update").put("id", id).put("name", name).put("category", category).put("section", section))
    }

    suspend fun deleteDish(snapshot: NSnapshot?, id: Int): NSnapshot = withContext(Dispatchers.IO) {
        postLive(JSONObject().put("expectedUpdatedAt", snapshot?.updatedAt ?: 0).put("action", "dish_delete").put("id", id))
    }

    private fun postLive(body: JSONObject): NSnapshot {
        var (code, text) = request("POST", "/api/ops/live", body.toString())
        if (code == 409) {
            val conflict = JSONObject(text)
            body.put("expectedUpdatedAt", conflict.optLong("updatedAt", 0))
            val retry = request("POST", "/api/ops/live", body.toString())
            code = retry.first
            text = retry.second
        }
        if (code !in 200..299) throw Exception(runCatching { JSONObject(text).optString("error", "Action failed") }.getOrDefault("Action failed"))
        return parseSnapshot(JSONObject(text))
    }

    suspend fun loadPrep(date: String, section: String): List<NPrep> = withContext(Dispatchers.IO) {
        val (code, text) = request("GET", "/api/ops/prep?date=${Uri.encode(date)}&section=${Uri.encode(section)}", null)
        if (code !in 200..299) throw Exception("Unable to load prep")
        val root = JSONObject(text)
        val array = root.optJSONArray("items") ?: JSONArray()
        buildList {
            for (i in 0 until array.length()) {
                val x = array.optJSONObject(i) ?: continue
                add(NPrep(x.optLong("id"), x.optString("section"), x.optString("item"), x.optString("quantity"), x.optString("notes"), x.optBoolean("completed")))
            }
        }
    }

    suspend fun togglePrep(id: Long, completed: Boolean) = withContext(Dispatchers.IO) {
        postPrep(JSONObject().put("action", "toggle").put("id", id).put("completed", completed).put("completedBy", "Kitchen"))
    }

    suspend fun addPrep(date: String, item: String, qty: String, notes: String, section: String) = withContext(Dispatchers.IO) {
        postPrep(JSONObject().put("action", "add").put("prepDate", date).put("item", item).put("quantity", qty).put("notes", notes).put("section", section).put("createdBy", "Kitchen"))
    }

    private fun postPrep(body: JSONObject) {
        val (code, text) = request("POST", "/api/ops/prep", body.toString())
        if (code !in 200..299) throw Exception(runCatching { JSONObject(text).optString("error", "Save failed") }.getOrDefault("Save failed"))
    }

    private fun request(method: String, path: String, body: String?): Pair<Int, String> {
        val connection = (URL(base + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 5000
            readTimeout = 5000
            setRequestProperty("User-Agent", ua)
            setRequestProperty("Accept", "application/json")
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                outputStream.use { it.write(body.toByteArray()) }
            }
        }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()
        return code to text
    }

    private fun parseSnapshot(root: JSONObject): NSnapshot {
        val state = root.optJSONObject("state") ?: JSONObject()
        val array = state.optJSONArray("foods") ?: JSONArray()
        val foods = buildList {
            for (i in 0 until array.length()) {
                val f = array.optJSONObject(i) ?: continue
                add(NFood(f.optInt("id"), f.optString("name", "Dish"), f.optString("category", "Other"), f.optInt("section", 1), f.optString("status", "GOOD"), f.optString("kitchen", "idle"), f.optLong("start", 0), f.optLong("requestedAt", 0)))
            }
        }
        return NSnapshot(foods, root.optLong("updatedAt", 0))
    }
}

private fun tomorrowSydneyNative(): String {
    val zone = TimeZone.getTimeZone("Australia/Sydney")
    val calendar = Calendar.getInstance(zone)
    calendar.add(Calendar.DAY_OF_MONTH, 1)
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone }.format(calendar.time)
}
