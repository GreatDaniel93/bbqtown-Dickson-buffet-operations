package com.bbqtown.dickson.ops

import android.content.Context
import android.content.Intent
import android.graphics.Color as AndroidColor
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
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
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

private val Ink = Color(0xFF172018)
private val Canvas = Color(0xFFF4F3EE)
private val SurfaceSoft = Color(0xFFF9FAF7)
private val Line = Color(0xFFE1E6E0)
private val Muted = Color(0xFF69736C)
private val Green = Color(0xFF2F7D4A)
private val GreenSoft = Color(0xFFE7F4EA)
private val Gold = Color(0xFFC58213)
private val GoldSoft = Color(0xFFFFF1D5)
private val Red = Color(0xFFBE3030)
private val RedSoft = Color(0xFFFFE8E5)
private val Slate = Color(0xFF52615A)

class OpsActivity : ComponentActivity() {
    private lateinit var prefs: android.content.SharedPreferences
    private val api = OpsApi()
    private var tone: ToneGenerator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        prefs = getSharedPreferences("bbqtown_ops_v2", Context.MODE_PRIVATE)
        setContent {
            BbqTheme {
                NativeOpsApp(
                    initialRole = prefs.getString("role", "").orEmpty(),
                    api = api,
                    saveRole = { prefs.edit().putString("role", it).apply() },
                    openWeb = { openWeb(it) },
                    kitchenAlert = { playKitchenAlert() }
                )
            }
        }
    }

    private fun openWeb(path: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://bbqtowndickson.com$path")))
    }

    private fun playKitchenAlert() {
        try {
            if (tone == null) tone = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            tone?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 650)
        } catch (_: Exception) {}
        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val pattern = longArrayOf(0, 160, 90, 160)
            if (android.os.Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            else @Suppress("DEPRECATION") vibrator.vibrate(pattern, -1)
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        tone?.release(); tone = null
        super.onDestroy()
    }
}

@Composable
private fun BbqTheme(content: @Composable () -> Unit) {
    val scheme = lightColorScheme(
        primary = Ink,
        onPrimary = Color.White,
        secondary = Gold,
        background = Canvas,
        surface = Color.White,
        onSurface = Ink,
        outline = Line
    )
    MaterialTheme(colorScheme = scheme, typography = Typography(), content = content)
}

private enum class Role(val key: String, val title: String, val subtitle: String) {
    FOH("foh", "FOH FLOOR", "Buffet status and refill requests"),
    K1("s1", "KITCHEN 1", "Hot food · meat · seafood"),
    K2("s2", "KITCHEN 2", "Vegetables · sides · dessert"),
    MANAGER("manager", "STORE TOOLS", "Bookings, tables, vouchers and prep")
}

@Composable
private fun NativeOpsApp(
    initialRole: String,
    api: OpsApi,
    saveRole: (String) -> Unit,
    openWeb: (String) -> Unit,
    kitchenAlert: () -> Unit
) {
    var roleKey by remember { mutableStateOf(initialRole) }
    var showRolePicker by remember { mutableStateOf(roleKey.isBlank()) }
    var prepOpen by remember { mutableStateOf(false) }

    if (showRolePicker) {
        RolePicker(
            current = roleKey,
            onPick = { roleKey = it; saveRole(it); showRolePicker = false; prepOpen = false },
            dismissible = roleKey.isNotBlank(),
            onDismiss = { showRolePicker = false }
        )
        return
    }

    if (prepOpen) {
        PrepScreen(api = api, roleKey = roleKey, onBack = { prepOpen = false })
        return
    }

    when (roleKey) {
        "foh" -> FohScreen(api, onDevice = { showRolePicker = true }, onPrep = { prepOpen = true })
        "s1" -> KitchenScreen(api, 1, kitchenAlert, onDevice = { showRolePicker = true }, onPrep = { prepOpen = true })
        "s2" -> KitchenScreen(api, 2, kitchenAlert, onDevice = { showRolePicker = true }, onPrep = { prepOpen = true })
        "manager" -> StoreToolsScreen(openWeb, onDevice = { showRolePicker = true }, onPrep = { prepOpen = true })
        else -> RolePicker(roleKey, { roleKey = it; saveRole(it); showRolePicker = false }, false) { }
    }
}

@Composable
private fun RolePicker(current: String, onPick: (String) -> Unit, dismissible: Boolean, onDismiss: () -> Unit) {
    Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
        Box(modifier = Modifier.fillMaxSize().padding(28.dp)) {
            Column(modifier = Modifier.fillMaxWidth().widthIn(max = 780.dp).align(Alignment.Center)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(42.dp).background(Gold, RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) {
                        Text("BBQ", fontWeight = FontWeight.Black, color = Ink, fontSize = 12.sp)
                    }
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text("BBQ TOWN OPS", color = Color.White, fontWeight = FontWeight.Black, fontSize = 24.sp)
                        Text("Dickson · Native Operations", color = Color(0xFFB8C6BC), fontSize = 13.sp)
                    }
                }
                Spacer(Modifier.height(34.dp))
                Text("Set this device", color = Color.White, fontWeight = FontWeight.Black, fontSize = 34.sp)
                Text("Choose one permanent workspace. The app opens straight into it next time.", color = Color(0xFFB8C6BC), fontSize = 15.sp)
                Spacer(Modifier.height(22.dp))
                Role.entries.forEach { role ->
                    val selected = current == role.key
                    Surface(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable { onPick(role.key) },
                        color = if (selected) Color(0xFF233C2A) else Color(0xFF202B22),
                        shape = RoundedCornerShape(18.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) Gold else Color(0xFF344139))
                    ) {
                        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(10.dp).background(if (selected) Gold else Color(0xFF65736A), CircleShape))
                            Spacer(Modifier.width(16.dp))
                            Column(Modifier.weight(1f)) {
                                Text(role.title, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                                Text(role.subtitle, color = Color(0xFFB8C6BC), fontSize = 13.sp)
                            }
                            Text("›", color = Gold, fontSize = 30.sp, fontWeight = FontWeight.Light)
                        }
                    }
                }
                if (dismissible) {
                    Spacer(Modifier.height(12.dp))
                    TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.End)) { Text("Cancel", color = Color.White) }
                }
            }
        }
    }
}

@Composable
private fun AppHeader(title: String, subtitle: String, onDevice: () -> Unit, trailing: @Composable RowScope.() -> Unit = {}) {
    Surface(color = Ink) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(title, color = Color.White, fontWeight = FontWeight.Black, fontSize = 23.sp)
                Text(subtitle, color = Color(0xFFB8C6BC), fontSize = 12.sp)
            }
            trailing()
            Spacer(Modifier.width(8.dp))
            TextButton(onClick = onDevice) { Text("DEVICE", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp) }
        }
    }
}

@Composable
private fun rememberLiveState(api: OpsApi): Triple<Snapshot?, Boolean, String?> {
    var snapshot by remember { mutableStateOf<Snapshot?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        while (true) {
            try {
                snapshot = api.loadLive()
                error = null
            } catch (e: Exception) { error = e.message ?: "Connection error" }
            loading = false
            delay(3500)
        }
    }
    return Triple(snapshot, loading, error)
}

@Composable
private fun StatusSummary(foods: List<FoodItem>) {
    val good = foods.count { it.status == "GOOD" }
    val low = foods.count { it.status == "LOW" }
    val empty = foods.count { it.status == "EMPTY" }
    val tasks = foods.count { it.kitchen != "idle" }
    Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        SummaryTile("GOOD", good, Green, Modifier.weight(1f))
        SummaryTile("LOW", low, Gold, Modifier.weight(1f))
        SummaryTile("EMPTY", empty, Red, Modifier.weight(1f))
        SummaryTile("KITCHEN", tasks, Slate, Modifier.weight(1f))
    }
}

@Composable
private fun SummaryTile(label: String, value: Int, accent: Color, modifier: Modifier = Modifier) {
    Surface(modifier, color = Color.White, shape = RoundedCornerShape(15.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Line)) {
        Column(Modifier.padding(14.dp)) {
            Text(value.toString(), fontSize = 26.sp, fontWeight = FontWeight.Black, color = Ink)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).background(accent, CircleShape)); Spacer(Modifier.width(6.dp))
                Text(label, fontSize = 9.sp, fontWeight = FontWeight.Black, color = Muted)
            }
        }
    }
}

@Composable
private fun FohScreen(api: OpsApi, onDevice: () -> Unit, onPrep: () -> Unit) {
    val (snapshot, loading, error) = rememberLiveState(api)
    var category by remember { mutableStateOf("ALL") }
    var busyId by remember { mutableStateOf<Int?>(null) }
    var localSnapshot by remember { mutableStateOf<Snapshot?>(null) }
    LaunchedEffect(snapshot?.updatedAt) { if (snapshot != null) localSnapshot = snapshot }
    val foods = localSnapshot?.foods ?: emptyList()
    val categories = listOf("ALL") + foods.map { it.category }.distinct()

    Column(Modifier.fillMaxSize().background(Canvas)) {
        AppHeader("FOH FLOOR", "Buffet status · one tap to notify kitchen", onDevice) {
            TextButton(onClick = onPrep) { Text("PREP", color = Gold, fontWeight = FontWeight.Black) }
        }
        if (loading && foods.isEmpty()) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Gold)
        error?.let { ErrorBanner(it) }
        StatusSummary(foods)

        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            categories.take(5).forEach { c ->
                FilterChip(selected = category == c, onClick = { category = c }, label = { Text(c, fontWeight = FontWeight.Bold, fontSize = 11.sp) })
            }
        }

        val priority = foods.filter { it.status == "EMPTY" || it.kitchen == "ready" }
        if (priority.isNotEmpty()) {
            Surface(Modifier.fillMaxWidth().padding(20.dp, 10.dp), color = GoldSoft, shape = RoundedCornerShape(16.dp)) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("PRIORITY NOW", fontWeight = FontWeight.Black, fontSize = 14.sp)
                        Text("${priority.size} item${if (priority.size == 1) "" else "s"} need floor action", color = Muted, fontSize = 12.sp)
                    }
                    Box(Modifier.size(34.dp).background(Gold, CircleShape), contentAlignment = Alignment.Center) { Text(priority.size.toString(), fontWeight = FontWeight.Black) }
                }
            }
        }

        LazyColumn(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            val shown = foods.filter { category == "ALL" || it.category == category }
            items(shown, key = { it.id }) { food ->
                FoodFloorCard(food, busyId == food.id) { action ->
                    busyId = food.id
                    api.launchAction(localSnapshot, action, food.id) { result, err ->
                        busyId = null
                        if (result != null) localSnapshot = result
                    }
                }
            }
            item { Spacer(Modifier.height(20.dp)) }
        }
    }
}

@Composable
private fun FoodFloorCard(food: FoodItem, busy: Boolean, onAction: (String) -> Unit) {
    val accent = when (food.status) { "LOW" -> Gold; "EMPTY" -> Red; else -> Green }
    Surface(color = Color.White, shape = RoundedCornerShape(16.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Line)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(food.name, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text("${food.category} · Section ${food.section}", color = Muted, fontSize = 11.sp)
                }
                StatusPill(food.status, accent)
            }
            Spacer(Modifier.height(11.dp))
            if (food.kitchen == "ready") {
                Button(onClick = { onAction("refilled") }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(50.dp), colors = ButtonDefaults.buttonColors(containerColor = Green), shape = RoundedCornerShape(12.dp)) {
                    Text("REFILLED · START NEW BATCH", fontWeight = FontWeight.Black)
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StateButton("GOOD", Green, GreenSoft, food.status == "GOOD", !busy, Modifier.weight(1f)) { onAction("status:GOOD") }
                    StateButton("LOW", Gold, GoldSoft, food.status == "LOW", !busy, Modifier.weight(1f)) { onAction("status:LOW") }
                    StateButton("EMPTY", Red, RedSoft, food.status == "EMPTY", !busy, Modifier.weight(1f)) { onAction("status:EMPTY") }
                }
            }
        }
    }
}

@Composable
private fun StateButton(label: String, color: Color, soft: Color, selected: Boolean, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Surface(
        modifier = modifier.height(50.dp).clickable(enabled = enabled, onClick = onClick),
        color = if (selected) color else soft,
        shape = RoundedCornerShape(12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, color.copy(alpha = .35f))
    ) {
        Box(contentAlignment = Alignment.Center) { Text(label, color = if (selected) Color.White else color, fontWeight = FontWeight.Black, fontSize = 12.sp) }
    }
}

@Composable
private fun StatusPill(text: String, color: Color) {
    Surface(color = color.copy(alpha = .12f), shape = RoundedCornerShape(999.dp)) {
        Text(text, color = color, fontWeight = FontWeight.Black, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp))
    }
}

@Composable
private fun KitchenScreen(api: OpsApi, section: Int, kitchenAlert: () -> Unit, onDevice: () -> Unit, onPrep: () -> Unit) {
    val (snapshot, loading, error) = rememberLiveState(api)
    var localSnapshot by remember { mutableStateOf<Snapshot?>(null) }
    var previousNew by remember { mutableIntStateOf(-1) }
    var busyId by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(snapshot?.updatedAt) { if (snapshot != null) localSnapshot = snapshot }
    val tasks = (localSnapshot?.foods ?: emptyList()).filter { it.section == section && it.kitchen != "idle" }
    val newCount = tasks.count { it.kitchen == "requested" }
    LaunchedEffect(newCount) {
        if (previousNew >= 0 && newCount > previousNew) kitchenAlert()
        previousNew = newCount
    }

    Column(Modifier.fillMaxSize().background(Ink)) {
        AppHeader("KITCHEN $section", if (section == 1) "Hot food · meat · seafood" else "Vegetables · sides · dessert", onDevice) {
            Button(onClick = onPrep, colors = ButtonDefaults.buttonColors(containerColor = Gold), shape = RoundedCornerShape(12.dp)) { Text("TOMORROW PREP", color = Ink, fontWeight = FontWeight.Black, fontSize = 11.sp) }
        }
        if (loading && tasks.isEmpty()) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Gold)
        error?.let { ErrorBanner(it) }

        Row(Modifier.fillMaxWidth().padding(20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            DarkMetric("NEW", tasks.count { it.kitchen == "requested" }, Gold, Modifier.weight(1f))
            DarkMetric("PREPARING", tasks.count { it.kitchen == "preparing" }, Color(0xFF8AA2FF), Modifier.weight(1f))
            DarkMetric("READY", tasks.count { it.kitchen == "ready" }, Green, Modifier.weight(1f))
        }

        if (tasks.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("ALL CLEAR", color = Color.White, fontWeight = FontWeight.Black, fontSize = 30.sp)
                    Text("Waiting for floor requests", color = Color(0xFF9EACA2), fontSize = 14.sp)
                }
            }
        } else {
            LazyColumn(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(tasks.sortedWith(compareBy<FoodItem>({ it.kitchen != "requested" }, { it.status != "EMPTY" }, { it.requestedAt })), key = { it.id }) { food ->
                    KitchenTaskCard(food, busyId == food.id) { action ->
                        busyId = food.id
                        api.launchAction(localSnapshot, action, food.id) { result, _ ->
                            busyId = null
                            if (result != null) localSnapshot = result
                        }
                    }
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}

@Composable
private fun DarkMetric(label: String, value: Int, accent: Color, modifier: Modifier) {
    Surface(modifier, color = Color(0xFF202B22), shape = RoundedCornerShape(15.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF344139))) {
        Column(Modifier.padding(14.dp)) {
            Text(value.toString(), color = Color.White, fontSize = 27.sp, fontWeight = FontWeight.Black)
            Text(label, color = accent, fontSize = 9.sp, fontWeight = FontWeight.Black)
        }
    }
}

@Composable
private fun KitchenTaskCard(food: FoodItem, busy: Boolean, onAction: (String) -> Unit) {
    val urgent = food.status == "EMPTY"
    val border = if (urgent) Red else Gold
    Surface(color = Color(0xFFFDFEFB), shape = RoundedCornerShape(18.dp), border = androidx.compose.foundation.BorderStroke(2.dp, border)) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text(food.name, color = Ink, fontWeight = FontWeight.Black, fontSize = 22.sp)
                    Text(if (urgent) "EMPTY · URGENT" else "LOW · PREP NEXT", color = if (urgent) Red else Gold, fontWeight = FontWeight.Black, fontSize = 11.sp)
                }
                StatusPill(food.kitchen.uppercase(), when(food.kitchen){"ready"->Green;"preparing"->Color(0xFF526DD3);else->Gold})
            }
            Spacer(Modifier.height(14.dp))
            when (food.kitchen) {
                "requested" -> Button(onClick = { onAction("kitchen_prepare") }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(58.dp), colors = ButtonDefaults.buttonColors(containerColor = Ink), shape = RoundedCornerShape(13.dp)) { Text("START PREPARING", fontWeight = FontWeight.Black, fontSize = 15.sp) }
                "preparing" -> Button(onClick = { onAction("kitchen_ready") }, enabled = !busy, modifier = Modifier.fillMaxWidth().height(58.dp), colors = ButtonDefaults.buttonColors(containerColor = Green), shape = RoundedCornerShape(13.dp)) { Text("MARK READY TO REFILL", fontWeight = FontWeight.Black, fontSize = 15.sp) }
                else -> Surface(color = GreenSoft, shape = RoundedCornerShape(13.dp)) { Box(Modifier.fillMaxWidth().height(58.dp), contentAlignment = Alignment.Center) { Text("✓ READY · WAITING FOR FOH", color = Green, fontWeight = FontWeight.Black) } }
            }
        }
    }
}

@Composable
private fun StoreToolsScreen(openWeb: (String) -> Unit, onDevice: () -> Unit, onPrep: () -> Unit) {
    Column(Modifier.fillMaxSize().background(Canvas)) {
        AppHeader("STORE TOOLS", "Only the essentials for daily operations", onDevice)
        Column(Modifier.fillMaxWidth().widthIn(max = 900.dp).padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Daily tools", fontSize = 30.sp, fontWeight = FontWeight.Black)
            Text("Native operations stay in the app. These three customer/staff tools intentionally remain on the web.", color = Muted, fontSize = 13.sp)
            Spacer(Modifier.height(8.dp))
            ToolCard("TABLES", "Seating and table status", Gold) { openWeb("/tables.html") }
            ToolCard("BOOKINGS", "View and manage reservations", Green) { openWeb("/reservations.html") }
            ToolCard("VERIFY VOUCHER", "Staff 10% voucher redemption", Color(0xFF526DD3)) { openWeb("/vouchers") }
            ToolCard("KITCHEN PREP", "Tomorrow prep list and completion", Ink) { onPrep() }
        }
    }
}

@Composable
private fun ToolCard(title: String, subtitle: String, accent: Color, onClick: () -> Unit) {
    Surface(Modifier.fillMaxWidth().clickable(onClick = onClick), color = Color.White, shape = RoundedCornerShape(18.dp), border = androidx.compose.foundation.BorderStroke(1.dp, Line)) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp).background(accent.copy(alpha = .12f), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                Box(Modifier.size(12.dp).background(accent, CircleShape))
            }
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 18.sp, fontWeight = FontWeight.Black)
                Text(subtitle, color = Muted, fontSize = 12.sp)
            }
            Text("›", color = accent, fontSize = 32.sp)
        }
    }
}

@Composable
private fun PrepScreen(api: OpsApi, roleKey: String, onBack: () -> Unit) {
    val section = when(roleKey){"s1"->"S1";"s2"->"S2";else->"ALL"}
    val date = remember { tomorrowSydney() }
    var items by remember { mutableStateOf<List<PrepItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showAdd by remember { mutableStateOf(false) }

    fun refresh() {
        api.launchPrepLoad(date, section) { list, err -> items = list ?: items; error = err; loading = false }
    }
    LaunchedEffect(date, section) { refresh() }

    Column(Modifier.fillMaxSize().background(Canvas)) {
        Surface(color = Ink) {
            Row(Modifier.fillMaxWidth().padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = onBack) { Text("‹ BACK", color = Color.White, fontWeight = FontWeight.Bold) }
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text("TOMORROW PREP", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
                    Text(date, color = Color(0xFFB8C6BC), fontSize = 12.sp)
                }
                Button(onClick = { showAdd = true }, colors = ButtonDefaults.buttonColors(containerColor = Gold), shape = RoundedCornerShape(12.dp)) { Text("+ ADD", color = Ink, fontWeight = FontWeight.Black) }
            }
        }
        if (loading) LinearProgressIndicator(Modifier.fillMaxWidth(), color = Gold)
        error?.let { ErrorBanner(it) }
        val done = items.count { it.completed }
        Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Prep progress", fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text("$done of ${items.size} complete", color = Muted, fontSize = 12.sp)
            }
            Text(if(items.isEmpty()) "—" else "${(done * 100 / items.size)}%", fontSize = 28.sp, fontWeight = FontWeight.Black, color = if(done==items.size && items.isNotEmpty()) Green else Ink)
        }
        LazyColumn(contentPadding = PaddingValues(horizontal = 20.dp, vertical = 2.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            items(items, key = { it.id }) { item ->
                Surface(color = if(item.completed) GreenSoft else Color.White, shape = RoundedCornerShape(16.dp), border = androidx.compose.foundation.BorderStroke(1.dp, if(item.completed) Green.copy(alpha=.25f) else Line)) {
                    Row(Modifier.fillMaxWidth().clickable {
                        api.launchPrepToggle(item.id, !item.completed) { ok, err -> if(ok) refresh() else error = err }
                    }.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = item.completed, onCheckedChange = null, colors = CheckboxDefaults.colors(checkedColor = Green))
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(item.item, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = if(item.completed) Green else Ink)
                            val meta = listOf(item.quantity, item.section, item.notes).filter { it.isNotBlank() }.joinToString(" · ")
                            if(meta.isNotBlank()) Text(meta, color = Muted, fontSize = 11.sp)
                        }
                        if(item.completed) Text("DONE", color = Green, fontWeight = FontWeight.Black, fontSize = 10.sp)
                    }
                }
            }
            if(items.isEmpty() && !loading) item { Box(Modifier.fillParentMaxWidth().height(180.dp), contentAlignment = Alignment.Center) { Text("No prep items yet", color = Muted) } }
        }
    }

    if(showAdd) AddPrepDialog(date, roleKey, onDismiss = { showAdd = false }) { item, qty, notes, sec ->
        api.launchPrepAdd(date, item, qty, notes, sec) { ok, err -> if(ok){showAdd=false;refresh()} else error=err }
    }
}

@Composable
private fun AddPrepDialog(date: String, roleKey: String, onDismiss: () -> Unit, onSave: (String,String,String,String)->Unit) {
    var item by remember { mutableStateOf("") }
    var qty by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    val section = when(roleKey){"s1"->"S1";"s2"->"S2";else->"ALL"}
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add prep item", fontWeight = FontWeight.Black) },
        text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(item,{item=it},label={Text("Item")},singleLine=true,modifier=Modifier.fillMaxWidth())
            OutlinedTextField(qty,{qty=it},label={Text("Quantity · e.g. 3 trays / 5kg")},singleLine=true,modifier=Modifier.fillMaxWidth())
            OutlinedTextField(notes,{notes=it},label={Text("Notes")},modifier=Modifier.fillMaxWidth())
            Text("$date · $section", color = Muted, fontSize = 11.sp)
        } },
        confirmButton = { Button(onClick={if(item.isNotBlank())onSave(item,qty,notes,section)},colors=ButtonDefaults.buttonColors(containerColor=Ink)){Text("ADD PREP") } },
        dismissButton = { TextButton(onClick=onDismiss){Text("Cancel")} }
    )
}

@Composable
private fun ErrorBanner(text: String) {
    Surface(Modifier.fillMaxWidth(), color = RedSoft) { Text(text, color = Red, fontWeight = FontWeight.Bold, fontSize = 12.sp, modifier = Modifier.padding(12.dp)) }
}

private data class FoodItem(
    val id: Int,
    val name: String,
    val category: String,
    val section: Int,
    val status: String,
    val kitchen: String,
    val start: Long,
    val requestedAt: Long
)
private data class Snapshot(val foods: List<FoodItem>, val updatedAt: Long)
private data class PrepItem(val id: Long, val section: String, val item: String, val quantity: String, val notes: String, val completed: Boolean)

private class OpsApi {
    private val base = "https://bbqtowndickson.com"
    private val ua = "BBQTownOpsAndroid/2.0 Native"

    suspend fun loadLive(): Snapshot = withContext(Dispatchers.IO) {
        val (code, text) = request("GET", "/api/ops/live", null)
        if(code !in 200..299) throw Exception("Unable to sync operations")
        parseSnapshot(JSONObject(text))
    }

    fun launchAction(snapshot: Snapshot?, actionSpec: String, id: Int, callback: (Snapshot?, String?) -> Unit) {
        val owner = CurrentActivityHolder.activity ?: return
        owner.lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val body = JSONObject().put("expectedUpdatedAt", snapshot?.updatedAt ?: 0)
                    if(actionSpec.startsWith("status:")) {
                        body.put("action","status").put("status",actionSpec.substringAfter(':')).put("id",id)
                    } else body.put("action", actionSpec).put("id", id)
                    postLiveWithRetry(body)
                }
                callback(result, null)
            } catch(e: Exception) { callback(null, e.message ?: "Action failed") }
        }
    }

    private fun postLiveWithRetry(body: JSONObject): Snapshot {
        var (code, text) = request("POST", "/api/ops/live", body.toString())
        if(code == 409) {
            val conflict = JSONObject(text)
            body.put("expectedUpdatedAt", conflict.optLong("updatedAt",0))
            val second = request("POST", "/api/ops/live", body.toString())
            code = second.first; text = second.second
        }
        if(code !in 200..299) throw Exception(JSONObject(text).optString("error","Action failed"))
        return parseSnapshot(JSONObject(text))
    }

    fun launchPrepLoad(date:String, section:String, callback:(List<PrepItem>?,String?)->Unit){
        val owner=CurrentActivityHolder.activity?:return
        owner.lifecycleScope.launch{try{val list=withContext(Dispatchers.IO){
            val path="/api/ops/prep?date=${Uri.encode(date)}&section=${Uri.encode(section)}";val(code,text)=request("GET",path,null);if(code !in 200..299)throw Exception("Unable to load prep");parsePrep(JSONObject(text))
        };callback(list,null)}catch(e:Exception){callback(null,e.message)}}
    }
    fun launchPrepToggle(id:Long, completed:Boolean, callback:(Boolean,String?)->Unit){postPrep(JSONObject().put("action","toggle").put("id",id).put("completed",completed).put("completedBy","Kitchen"),callback)}
    fun launchPrepAdd(date:String,item:String,qty:String,notes:String,section:String,callback:(Boolean,String?)->Unit){postPrep(JSONObject().put("action","add").put("prepDate",date).put("item",item).put("quantity",qty).put("notes",notes).put("section",section).put("createdBy","Kitchen"),callback)}
    private fun postPrep(body:JSONObject,callback:(Boolean,String?)->Unit){val owner=CurrentActivityHolder.activity?:return;owner.lifecycleScope.launch{try{withContext(Dispatchers.IO){val(code,text)=request("POST","/api/ops/prep",body.toString());if(code !in 200..299)throw Exception(JSONObject(text).optString("error","Save failed"))};callback(true,null)}catch(e:Exception){callback(false,e.message)}}}

    private fun request(method:String,path:String,body:String?):Pair<Int,String>{
        val conn=(URL(base+path).openConnection() as HttpURLConnection).apply{
            requestMethod=method;connectTimeout=7000;readTimeout=7000;setRequestProperty("User-Agent",ua);setRequestProperty("Accept","application/json")
            if(body!=null){doOutput=true;setRequestProperty("Content-Type","application/json");outputStream.use{it.write(body.toByteArray())}}
        }
        val code=conn.responseCode
        val stream=if(code in 200..299)conn.inputStream else conn.errorStream
        val text=stream?.bufferedReader()?.use{it.readText()}.orEmpty();conn.disconnect();return code to text
    }

    private fun parseSnapshot(root:JSONObject):Snapshot{
        val state=root.optJSONObject("state")?:JSONObject();val arr=state.optJSONArray("foods")?:JSONArray();val foods=mutableListOf<FoodItem>()
        for(i in 0 until arr.length()){val f=arr.optJSONObject(i)?:continue;foods+=FoodItem(f.optInt("id"),f.optString("name","Dish"),f.optString("category","Other"),f.optInt("section",1),f.optString("status","GOOD"),f.optString("kitchen","idle"),f.optLong("start",0),f.optLong("requestedAt",0))}
        return Snapshot(foods,root.optLong("updatedAt",0))
    }
    private fun parsePrep(root:JSONObject):List<PrepItem>{val arr=root.optJSONArray("items")?:JSONArray();return buildList{for(i in 0 until arr.length()){val x=arr.optJSONObject(i)?:continue;add(PrepItem(x.optLong("id"),x.optString("section"),x.optString("item"),x.optString("quantity"),x.optString("notes"),x.optBoolean("completed")))}}}
}

private object CurrentActivityHolder { var activity: ComponentActivity? = null }

private fun tomorrowSydney(): String {
    val cal = Calendar.getInstance(TimeZone.getTimeZone("Australia/Sydney")); cal.add(Calendar.DAY_OF_MONTH,1)
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone=TimeZone.getTimeZone("Australia/Sydney") }.format(cal.time)
}
