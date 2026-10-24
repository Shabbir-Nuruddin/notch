package expo.modules.notchguard

import android.content.Context
import org.json.JSONObject

// What to block and when, as last sent from JS. Kept in
// SharedPreferences so the service still works when the app is closed.
//
// JSON shape:
//   { "enabled": true, "blocked": ["com.instagram.android"],
//     "windows": [{ "start": 1761300000000, "end": 1761303600000, "title": "Revise chapter 4" }],
//     "pausedUntil": 0 }
internal class GuardWindow(val start: Long, val end: Long, val title: String)

internal class GuardRules(
  val enabled: Boolean,
  val blocked: Set<String>,
  val windows: List<GuardWindow>,
  val pausedUntil: Long
) {
  fun activeWindow(now: Long): GuardWindow? {
    if (!enabled || now < pausedUntil) return null
    return windows.firstOrNull { now >= it.start && now < it.end }
  }

  companion object {
    private const val FILE = "notch_guard"
    private const val KEY = "rules"

    private val EMPTY = GuardRules(false, emptySet(), emptyList(), 0L)

    // The service reads rules on every app switch; parse only when the
    // stored text has changed.
    private var cachedRaw: String? = null
    private var cached: GuardRules = EMPTY

    fun raw(context: Context): String =
      context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null) ?: "{}"

    fun save(context: Context, json: String) {
      context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
    }

    @Synchronized
    fun load(context: Context): GuardRules {
      val text = raw(context)
      if (text == cachedRaw) return cached
      cached = parse(text)
      cachedRaw = text
      return cached
    }

    private fun parse(text: String): GuardRules {
      return try {
        val json = JSONObject(text)
        val blocked = HashSet<String>()
        val blockedJson = json.optJSONArray("blocked")
        if (blockedJson != null) {
          for (i in 0 until blockedJson.length()) blocked.add(blockedJson.optString(i))
        }
        val windows = ArrayList<GuardWindow>()
        val windowsJson = json.optJSONArray("windows")
        if (windowsJson != null) {
          for (i in 0 until windowsJson.length()) {
            val w = windowsJson.optJSONObject(i) ?: continue
            windows.add(GuardWindow(w.optLong("start"), w.optLong("end"), w.optString("title")))
          }
        }
        GuardRules(json.optBoolean("enabled", false), blocked, windows, json.optLong("pausedUntil", 0L))
      } catch (e: Exception) {
        EMPTY
      }
    }
  }
}
