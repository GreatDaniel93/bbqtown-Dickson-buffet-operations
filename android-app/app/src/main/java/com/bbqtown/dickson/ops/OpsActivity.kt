package com.bbqtown.dickson.ops

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import java.util.UUID

class OpsActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var offlineMessage: TextView
    private lateinit var connectionBadge: TextView
    private lateinit var roleBadge: TextView
    private lateinit var prefs: SharedPreferences
    private lateinit var connectivityManager: ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private val handler = Handler(Looper.getMainLooper())
    private var toneGenerator: ToneGenerator? = null
    private var pendingKitchenTasks = 0
    private var currentRole = ""
    private lateinit var deviceId: String

    companion object {
        private const val OPS_URL = "https://bbqtowndickson.com/ops.html"
        private const val TABLES_URL = "https://bbqtowndickson.com/tables.html"
        private const val DASHBOARD_URL = "https://bbqtowndickson.com/manager-dashboard.html"
        private const val ALLOWED_HOST = "bbqtowndickson.com"
        private const val PREF_ROLE = "device_role"
        private const val PREF_DEVICE_ID = "device_id"
        private const val APP_VERSION = "1.5.0"
        private const val ALERT_REPEAT_MS = 30_000L
        private val BLOCKED_PREFIXES = listOf("/book", "/reservations", "/voucher", "/vouchers", "/staff")
    }

    private val repeatAlert = object : Runnable {
        override fun run() {
            if ((currentRole == "s1" || currentRole == "s2") && pendingKitchenTasks > 0) {
                playKitchenAlert()
                handler.postDelayed(this, ALERT_REPEAT_MS)
            }
        }
    }

    inner class NativeOpsBridge {
        @JavascriptInterface fun click() = runOnUiThread { playClick() }
        @JavascriptInterface fun urgent() = runOnUiThread { playKitchenAlert() }
        @JavascriptInterface fun getDeviceId(): String = deviceId
        @JavascriptInterface fun getAppVersion(): String = APP_VERSION
        @JavascriptInterface fun kitchenTasks(count: Int) {
            runOnUiThread {
                val safe = count.coerceAtLeast(0)
                val increased = safe > pendingKitchenTasks
                pendingKitchenTasks = safe
                handler.removeCallbacks(repeatAlert)
                if (increased && safe > 0) playKitchenAlert()
                if ((currentRole == "s1" || currentRole == "s2") && safe > 0) {
                    handler.postDelayed(repeatAlert, ALERT_REPEAT_MS)
                }
            }
        }
    }

    private fun playClick() {
        try {
            if (toneGenerator == null) toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 85)
        } catch (_: Exception) {}
    }

    private fun playKitchenAlert() {
        try {
            if (toneGenerator == null) toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            toneGenerator?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 700)
        } catch (_: Exception) {}
        try {
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val pattern = longArrayOf(0, 180, 100, 180, 100, 280)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        } catch (_: Exception) {}
    }

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        volumeControlStream = AudioManager.STREAM_MUSIC
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        prefs = getSharedPreferences("bbqtown_ops", Context.MODE_PRIVATE)
        currentRole = prefs.getString(PREF_ROLE, "").orEmpty()
        deviceId = prefs.getString(PREF_DEVICE_ID, "").orEmpty().ifBlank {
            val generated = "dickson-" + UUID.randomUUID().toString().substring(0, 8)
            prefs.edit().putString(PREF_DEVICE_ID, generated).apply()
            generated
        }
        enableImmersiveMode()

        val root = FrameLayout(this)
        webView = WebView(this)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        offlineMessage = TextView(this).apply {
            text = "Unable to connect to BBQ Town Ops.\nCheck Wi-Fi / internet and tap to retry."
            textSize = 17f
            gravity = Gravity.CENTER
            setPadding(32, 32, 32, 32)
            setBackgroundColor(Color.rgb(245, 244, 239))
            setTextColor(Color.rgb(23, 32, 24))
            visibility = View.GONE
            setOnClickListener { playClick(); webView.reload() }
        }
        connectionBadge = TextView(this).apply {
            text = "ONLINE"
            textSize = 12f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setPadding(dp(14), dp(7), dp(14), dp(7))
            background = roundedBackground(Color.rgb(46, 125, 73), dp(16).toFloat())
        }
        roleBadge = TextView(this).apply {
            textSize = 11f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setPadding(dp(14), dp(9), dp(14), dp(9))
            background = roundedBackground(Color.rgb(23, 32, 24), dp(10).toFloat())
            setOnClickListener { playClick(); showRoleChooser(false) }
        }

        root.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        root.addView(progress, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(3)))
        root.addView(offlineMessage, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        root.addView(connectionBadge, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.TOP or Gravity.END; topMargin = dp(10); marginEnd = dp(10)
        })
        root.addView(roleBadge, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.BOTTOM or Gravity.END; bottomMargin = dp(12); marginEnd = dp(12)
        })
        setContentView(root)

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            userAgentString = "$userAgentString BBQTownOpsAndroid/1.5"
        }
        webView.addJavascriptInterface(NativeOpsBridge(), "BBQNativeOps")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val host = request.url.host?.lowercase().orEmpty()
                val path = request.url.path.orEmpty()
                if (host != ALLOWED_HOST && host != "www.$ALLOWED_HOST") return true
                if (BLOCKED_PREFIXES.any { path.startsWith(it) }) { loadRoleHome(); return true }
                return false
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                offlineMessage.visibility = View.GONE
                injectAppBehaviour(view)
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) offlineMessage.visibility = View.VISIBLE
            }
        }

        registerNetworkStatus()
        updateRoleBadge()
        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else if (currentRole.isBlank()) showRoleChooser(true)
        else loadRoleHome()
    }

    private fun injectAppBehaviour(view: WebView) {
        val script = """
        (function(){
          const role=${jsString(currentRole)},deviceId=${jsString(deviceId)},appVersion=${jsString(APP_VERSION)};
          const hide=e=>{if(e)e.style.setProperty('display','none','important')};
          document.querySelectorAll('a[href^="/voucher"],a[href^="/reservations"],a[href^="/book"],a[href^="/staff"]').forEach(hide);
          hide(document.getElementById('bookingLink'));
          const brand=document.getElementById('brandSub');if(brand)brand.textContent='Dickson · Ops App';
          if(location.pathname.endsWith('/ops.html')){
            const target=document.querySelector('[data-view="'+role+'"]');
            if(target&&document.body.dataset.view!==role)target.click();
            document.querySelectorAll('.nav [data-view]').forEach(b=>{if(role&&b.getAttribute('data-view')!==role)hide(b)});
          }
          const post=(url,data)=>fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),keepalive:true}).catch(()=>{});
          const event=(type,label,payload={})=>post('/api/ops/events',{deviceId,role,eventType:type,label,payload});
          const countPending=()=>{const cols=document.querySelectorAll('.kcol');const first=cols.length?cols[0]:null;return first?first.querySelectorAll('.task').length:0};
          const heartbeat=()=>post('/api/ops/devices',{deviceId,role,appVersion,pendingTasks:countPending(),online:navigator.onLine,meta:{path:location.pathname,language:navigator.language}});
          heartbeat();setInterval(heartbeat,30000);window.addEventListener('online',heartbeat);window.addEventListener('offline',heartbeat);

          if(!window.__bbqAuditInstalled){
            window.__bbqAuditInstalled=true;
            document.addEventListener('click',e=>{try{
              const t=e.target?.closest?.('button,a,[role="button"],.task,.card');if(!t)return;
              if(window.BBQNativeOps?.click)window.BBQNativeOps.click();
              const label=(t.innerText||t.textContent||'').trim().replace(/\s+/g,' ').slice(0,180);
              const u=label.toUpperCase();
              if(/LOW|EMPTY|GOOD|READY|PREPAR|COMPLETE|START|CLEAR|RESET|WATER|ALL|BULK|RESTART/.test(u))event('ACTION',label,{view:document.body.dataset.view||role});
            }catch(_){}} ,true);
          }

          if((role==='s1'||role==='s2')&&!document.getElementById('__prepList')){
            const a=document.createElement('a');
            a.id='__prepList';a.href='/prep.html';a.textContent='TOMORROW PREP';
            a.style.cssText='position:fixed;left:12px;bottom:14px;z-index:220;background:#c58213;color:#172018;text-decoration:none;font-weight:950;font-size:12px;padding:13px 16px;border-radius:10px;box-shadow:0 5px 18px #0004';
            document.body.appendChild(a);
          }

          if((role==='s1'||role==='s2')&&!window.__bbqKitchenMonitorInstalled){
            window.__bbqKitchenMonitorInstalled=true;let last=-1;
            const firstSeen=new Map(),warned5=new Set(),warned10=new Set();
            const report=()=>{try{
              const cols=document.querySelectorAll('.kcol'),first=cols.length?cols[0]:null,tasks=first?[...first.querySelectorAll('.task')]:[];
              if(tasks.length!==last){last=tasks.length;window.BBQNativeOps?.kitchenTasks?.(last);heartbeat()}
              const now=Date.now(),active=new Set();
              tasks.forEach((task,i)=>{
                const key=((task.querySelector('h3')?.textContent||'Task')+'|'+(task.querySelector('p')?.textContent||'')+'|'+i).slice(0,220);
                active.add(key);if(!firstSeen.has(key))firstSeen.set(key,now);const age=now-firstSeen.get(key);
                if(age>=180000){task.style.boxShadow='0 0 0 3px #d89b26';task.style.borderLeftColor='#c58213'}
                if(age>=300000){task.style.boxShadow='0 0 0 4px #d64545';task.style.borderLeftColor='#d64545';if(!warned5.has(key)){warned5.add(key);event('SLA_5_MIN',task.querySelector('h3')?.textContent||'Kitchen task',{ageSeconds:Math.floor(age/1000)});window.BBQNativeOps?.urgent?.()}}
                if(age>=600000&&!warned10.has(key)){warned10.add(key);event('SLA_10_MIN',task.querySelector('h3')?.textContent||'Kitchen task',{ageSeconds:Math.floor(age/1000)});window.BBQNativeOps?.urgent?.()}
              });
              [...firstSeen.keys()].forEach(k=>{if(!active.has(k)){firstSeen.delete(k);warned5.delete(k);warned10.delete(k)}})
            }catch(_){}};
            report();new MutationObserver(report).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});setInterval(report,15000);
          }
        })();
        """.trimIndent()
        view.evaluateJavascript(script, null)
    }

    private fun showRoleChooser(firstRun: Boolean) {
        val dialog = AlertDialog.Builder(this).create()
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(22), dp(22), dp(18))
            setBackgroundColor(Color.rgb(250, 250, 247))
        }
        box.addView(TextView(this).apply {
            text = "BBQ TOWN"; textSize = 24f; setTextColor(Color.rgb(23, 32, 24)); setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        box.addView(TextView(this).apply {
            text = if (firstRun) "Set this tablet" else "Change device role"; textSize = 19f; setTextColor(Color.rgb(23, 32, 24)); setPadding(0, dp(4), 0, 0)
        })
        box.addView(TextView(this).apply {
            text = "Choose this device's permanent workspace. Device ID: $deviceId"; textSize = 12f; setTextColor(Color.rgb(101, 113, 105)); setPadding(0, dp(6), 0, dp(16))
        })
        val choices = listOf(
            Triple("foh", "FOH FLOOR", "Food status and floor operations"),
            Triple("s1", "KITCHEN SECTION 1", "Kitchen production · Section 1"),
            Triple("s2", "KITCHEN SECTION 2", "Kitchen production · Section 2"),
            Triple("manager", "MANAGER", "Today, attention, food safety and management"),
            Triple("tables", "TABLES", "Table status and seating")
        )
        choices.forEach { (role, label, desc) ->
            val b = Button(this).apply {
                text = "$label\n$desc"; textSize = 14f; gravity = Gravity.START or Gravity.CENTER_VERTICAL; isAllCaps = false
                setTextColor(Color.rgb(23, 32, 24)); setPadding(dp(16), dp(10), dp(16), dp(10))
                background = roundedStrokeBackground(if (role == currentRole) Color.rgb(235,245,238) else Color.WHITE, if (role == currentRole) Color.rgb(80,145,101) else Color.rgb(218,225,219), dp(10).toFloat())
                setOnClickListener {
                    playClick(); currentRole = role; prefs.edit().putString(PREF_ROLE, role).apply(); pendingKitchenTasks = 0
                    handler.removeCallbacks(repeatAlert); updateRoleBadge(); dialog.dismiss(); loadRoleHome()
                }
            }
            box.addView(b, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(66)).apply { bottomMargin = dp(8) })
        }
        box.addView(Button(this).apply {
            text = "TEST DEVICE SOUND"; textSize = 12f; setTextColor(Color.WHITE); background = roundedBackground(Color.rgb(23,32,24), dp(9).toFloat())
            setOnClickListener { playClick(); handler.postDelayed({ playKitchenAlert() }, 180) }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(48)))
        dialog.setView(box); dialog.setCancelable(!firstRun); dialog.show()
    }

    private fun loadRoleHome() {
        val url = when (currentRole) {
            "tables" -> TABLES_URL
            "manager" -> DASHBOARD_URL
            else -> OPS_URL
        }
        webView.loadUrl(url)
    }

    private fun updateRoleBadge() {
        roleBadge.text = when (currentRole) {
            "foh" -> "DEVICE · FOH"
            "s1" -> "DEVICE · KITCHEN 1"
            "s2" -> "DEVICE · KITCHEN 2"
            "manager" -> "DEVICE · MANAGER"
            "tables" -> "DEVICE · TABLES"
            else -> "DEVICE · SET ROLE"
        }
    }

    private fun registerNetworkStatus() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val update = { online: Boolean -> runOnUiThread {
            connectionBadge.text = if (online) "ONLINE" else "OFFLINE"
            connectionBadge.background = roundedBackground(if (online) Color.rgb(46,125,73) else Color.rgb(190,48,48), dp(16).toFloat())
        } }
        update(connectivityManager.activeNetwork != null)
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = update(true)
            override fun onLost(network: Network) = update(connectivityManager.activeNetwork != null)
        }
        connectivityManager.registerDefaultNetworkCallback(networkCallback!!)
    }

    private fun roundedBackground(color: Int, radius: Float) = GradientDrawable().apply { shape = GradientDrawable.RECTANGLE; setColor(color); cornerRadius = radius }
    private fun roundedStrokeBackground(fill: Int, stroke: Int, radius: Float) = GradientDrawable().apply { shape = GradientDrawable.RECTANGLE; setColor(fill); setStroke(dp(1), stroke); cornerRadius = radius }
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun jsString(v: String) = "\"" + v.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
    private fun enableImmersiveMode() { @Suppress("DEPRECATION") window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_LAYOUT_STABLE }

    override fun onWindowFocusChanged(hasFocus: Boolean) { super.onWindowFocusChanged(hasFocus); if (hasFocus) enableImmersiveMode() }
    override fun onSaveInstanceState(outState: Bundle) { webView.saveState(outState); super.onSaveInstanceState(outState) }
    @Deprecated("Deprecated in Java") override fun onBackPressed() { if (webView.canGoBack()) webView.goBack() else super.onBackPressed() }
    override fun onDestroy() {
        handler.removeCallbacks(repeatAlert)
        networkCallback?.let { try { connectivityManager.unregisterNetworkCallback(it) } catch (_: Exception) {} }
        toneGenerator?.release(); toneGenerator = null
        webView.destroy(); super.onDestroy()
    }
}
