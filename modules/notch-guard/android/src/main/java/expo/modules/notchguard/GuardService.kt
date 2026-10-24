package expo.modules.notchguard

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.net.Uri
import android.telecom.TelecomManager
import android.view.accessibility.AccessibilityEvent

// Watches which app comes to the front. If it's one the person chose
// to block and a task is running, Notch's focus screen opens on top.
// The service never reads window content (see notch_guard_service.xml).
class GuardService : AccessibilityService() {
  private var lastPackage: String? = null
  private var lastBounce = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg == packageName || neverBlock(pkg)) return

    val rules = GuardRules.load(this)
    if (!rules.blocked.contains(pkg)) return
    val now = System.currentTimeMillis()
    rules.activeWindow(now) ?: return

    // One app can fire several window events while it opens.
    if (pkg == lastPackage && now - lastBounce < 1500) return
    lastPackage = pkg
    lastBounce = now

    performGlobalAction(GLOBAL_ACTION_HOME)
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("notch://focus?blocked=" + Uri.encode(pkg))).apply {
      setPackage(packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    try {
      startActivity(intent)
    } catch (e: Exception) {
      // Going home already took the person out of the blocked app.
    }
  }

  // Calls, emergency help and system settings always stay reachable,
  // whatever the rules say.
  private fun neverBlock(pkg: String): Boolean {
    if (pkg in ALWAYS_ALLOWED) return true
    val dialer = try {
      (getSystemService(TELECOM_SERVICE) as? TelecomManager)?.defaultDialerPackage
    } catch (e: Exception) {
      null
    }
    return pkg == dialer
  }

  override fun onInterrupt() {}

  companion object {
    val ALWAYS_ALLOWED = setOf(
      "com.android.dialer",
      "com.google.android.dialer",
      "com.samsung.android.dialer",
      "com.android.phone",
      "com.android.server.telecom",
      "com.android.emergency",
      "com.google.android.apps.safetyhub",
      "com.android.settings",
      "com.android.systemui",
    )
  }
}
