package com.bbqtown.dickson.ops

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Bundle
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.activity.ComponentActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Small launcher that starts the kitchen alert monitor before opening the premium UI.
 * The monitor watches the same local cache that PremiumOpsActivity refreshes, so it
 * adds no extra API polling load.
 */
class KitchenAlertBootstrapActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        KitchenAlertMonitor.start(applicationContext)
        startActivity(Intent(this, PremiumOpsActivity::class.java))
        finish()
    }
}

object KitchenAlertMonitor {
    @Volatile private var started = false
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun start(context: Context) {
        if (started) return
        synchronized(this) {
            if (started) return
            started = true
        }

        val app = context.applicationContext
        scope.launch {
            val rolePrefs = app.getSharedPreferences("bbqtown_ops_v2", Context.MODE_PRIVATE)
            val api = FastApi(app)
            var lastSection = 0
            var seenRequests = emptySet<String>()
            var lastAlertAt = 0L

            while (isActive) {
                val section = when (rolePrefs.getString("role", "")) {
                    "s1" -> 1
                    "s2" -> 2
                    else -> 0
                }

                if (section == 0) {
                    lastSection = 0
                    seenRequests = emptySet()
                    delay(800)
                    continue
                }

                if (section != lastSection) {
                    lastSection = section
                    seenRequests = emptySet()
                    lastAlertAt = 0L
                }

                val requested = api.cachedLive()?.foods.orEmpty()
                    .filter { it.section == section && it.kitchen == "requested" }
                val requestKeys = requested.map { "${it.id}:${it.requestedAt}" }.toSet()
                val newRequests = requested.filter { "${it.id}:${it.requestedAt}" !in seenRequests }
                val now = System.currentTimeMillis()

                when {
                    newRequests.isNotEmpty() -> {
                        playAlert(app, urgent = newRequests.any { it.status == "EMPTY" })
                        lastAlertAt = now
                    }
                    requested.isNotEmpty() && now - lastAlertAt >= 60_000L -> {
                        // Repeat once a minute until the kitchen accepts the request.
                        playAlert(app, urgent = requested.any { it.status == "EMPTY" })
                        lastAlertAt = now
                    }
                }

                seenRequests = requestKeys
                delay(700)
            }
        }
    }

    private suspend fun playAlert(context: Context, urgent: Boolean) {
        try {
            val toneType = if (urgent) ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD else ToneGenerator.TONE_PROP_BEEP2
            val repeats = if (urgent) 3 else 2
            val tone = ToneGenerator(AudioManager.STREAM_ALARM, 100)
            try {
                repeat(repeats) {
                    tone.startTone(toneType, if (urgent) 420 else 300)
                    delay(if (urgent) 560 else 440)
                }
            } finally {
                tone.release()
            }
        } catch (_: Exception) {
            // Vibration below still provides a fallback alert.
        }

        try {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val pattern = if (urgent) longArrayOf(0, 220, 120, 220, 120, 320) else longArrayOf(0, 180, 120, 180)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        } catch (_: Exception) {
        }
    }
}
