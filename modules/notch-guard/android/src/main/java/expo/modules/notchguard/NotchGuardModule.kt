package expo.modules.notchguard

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import android.util.Base64
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

class NotchGuardModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("NotchGuard")

    // True once the person has switched on "Notch app blocking" in
    // Android's accessibility settings.
    Function("isServiceEnabled") {
      isServiceEnabled(context)
    }

    Function("openServiceSettings") {
      context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    // Rules arrive as JSON text; see GuardRules for the shape.
    Function("setRules") { json: String ->
      GuardRules.save(context, json)
    }

    Function("getRules") {
      GuardRules.raw(context)
    }

    // Every app with a launcher icon, as JSON:
    //   [{ packageName, label, category, icon (base64 PNG) }]
    AsyncFunction("getLaunchableApps") {
      launchableApps(context)
    }
  }

  private fun isServiceEnabled(ctx: Context): Boolean {
    val expected = ComponentName(ctx, GuardService::class.java)
    val enabled = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
      ?: return false
    val splitter = TextUtils.SimpleStringSplitter(':')
    splitter.setString(enabled)
    for (entry in splitter) {
      if (ComponentName.unflattenFromString(entry) == expected) return true
    }
    return false
  }

  private fun launchableApps(ctx: Context): String {
    val pm = ctx.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val seen = HashSet<String>()
    val apps = JSONArray()
    for (info in pm.queryIntentActivities(intent, 0)) {
      val pkg = info.activityInfo.packageName
      if (pkg == ctx.packageName || pkg in GuardService.ALWAYS_ALLOWED || !seen.add(pkg)) continue
      val app = JSONObject()
      app.put("packageName", pkg)
      app.put("label", info.loadLabel(pm).toString())
      app.put("category", category(info.activityInfo.applicationInfo))
      app.put("icon", iconBase64(info.loadIcon(pm)))
      apps.put(app)
    }
    return apps.toString()
  }

  private fun category(info: ApplicationInfo): String {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return "other"
    return when (info.category) {
      ApplicationInfo.CATEGORY_GAME -> "game"
      ApplicationInfo.CATEGORY_SOCIAL -> "social"
      ApplicationInfo.CATEGORY_VIDEO -> "video"
      ApplicationInfo.CATEGORY_NEWS -> "news"
      ApplicationInfo.CATEGORY_IMAGE -> "image"
      ApplicationInfo.CATEGORY_AUDIO -> "audio"
      ApplicationInfo.CATEGORY_MAPS -> "maps"
      ApplicationInfo.CATEGORY_PRODUCTIVITY -> "productivity"
      else -> "other"
    }
  }

  private fun iconBase64(drawable: Drawable): String {
    val size = 96
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, size, size)
    drawable.draw(canvas)
    val out = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
    return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
  }
}
