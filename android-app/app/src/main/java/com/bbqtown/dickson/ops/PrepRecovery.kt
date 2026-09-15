package com.bbqtown.dickson.ops

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Recovers prep checklist edits that the local-first UI marked pending/failed while offline.
 * The mutation id is deterministic for each local operation so a lost HTTP response cannot
 * duplicate an ADD or re-run a toggle unexpectedly.
 */
object PrepRecovery {
    @Volatile private var started = false
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val media = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(7, TimeUnit.SECONDS)
        .writeTimeout(7, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    fun start(context: Context) {
        if (started) return
        synchronized(this) { if (started) return; started = true }
        val app = context.applicationContext
        scope.launch {
            var failures = 0
            while (isActive) {
                val recovered = runCatching { recoverOnce(app) }.getOrElse { -1 }
                if (recovered >= 0) failures = 0 else failures = (failures + 1).coerceAtMost(8)
                val wait = when (failures) {
                    0 -> 12_000L
                    1 -> 5_000L
                    2 -> 10_000L
                    3 -> 20_000L
                    4 -> 40_000L
                    else -> 60_000L
                }
                delay(wait)
            }
        }
    }

    private fun recoverOnce(context: Context): Int {
        if (!DeviceSession.isPaired(context)) return 0
        val prefs = context.getSharedPreferences("bbqtown_ops_cache", Context.MODE_PRIVATE)
        val keys = prefs.all.keys.filter { it.startsWith("prep:") }
        var changedLists = 0
        for (key in keys) {
            val raw = prefs.getString(key, null) ?: continue
            val parts = key.split(":", limit = 3)
            if (parts.size < 3) continue
            val date = parts[1]
            val defaultSection = parts[2]
            val array = runCatching { JSONArray(raw) }.getOrNull() ?: continue
            var changed = false
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                if (!item.optBoolean("pending") && !item.optBoolean("failed")) continue
                val id = item.optLong("id")
                val section = item.optString("section", defaultSection).ifBlank { defaultSection }
                val result = if (id < 0) {
                    val mutationId = "prep-add:${DeviceSession.deviceId(context)}:${kotlin.math.abs(id)}"
                    post(context, JSONObject()
                        .put("action", "add")
                        .put("mutationId", mutationId)
                        .put("prepDate", date)
                        .put("section", section)
                        .put("item", item.optString("item"))
                        .put("quantity", item.optString("quantity"))
                        .put("notes", item.optString("notes"))
                        .put("createdBy", "Kitchen offline recovery"))
                } else {
                    val target = item.optBoolean("completed")
                    val mutationId = "prep-toggle:${DeviceSession.deviceId(context)}:$id:$target"
                    post(context, JSONObject()
                        .put("action", "toggle")
                        .put("mutationId", mutationId)
                        .put("id", id)
                        .put("completed", target)
                        .put("completedBy", "Kitchen offline recovery"))
                } ?: continue

                val server = result.optJSONObject("item") ?: continue
                val replacement = JSONObject()
                    .put("id", server.optLong("id"))
                    .put("section", server.optString("section", section))
                    .put("item", server.optString("item", item.optString("item")))
                    .put("quantity", server.optString("quantity", item.optString("quantity")))
                    .put("notes", server.optString("notes", item.optString("notes")))
                    .put("completed", server.optBoolean("completed", item.optBoolean("completed")))
                    .put("pending", false)
                    .put("failed", false)
                array.put(index, replacement)
                changed = true
            }
            if (changed) {
                prefs.edit().putString(key, array.toString()).apply()
                changedLists++
            }
        }
        return changedLists
    }

    private fun post(context: Context, body: JSONObject): JSONObject? {
        val token = runCatching { DeviceSession.ensureAccessBlocking(context) }.getOrNull().orEmpty()
        if (token.isBlank()) return null
        val request = Request.Builder()
            .url("https://bbqtowndickson.com/api/ops/prep")
            .header("User-Agent", "BBQTownOpsAndroid/${BuildConfig.VERSION_NAME} Native")
            .header("Accept", "application/json")
            .header("x-bbqtown-device-token", token)
            .post(body.toString().toRequestBody(media))
            .build()
        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (response.code == 409) return null
            if (!response.isSuccessful) return null
            return runCatching { JSONObject(text) }.getOrNull()
        }
    }
}
