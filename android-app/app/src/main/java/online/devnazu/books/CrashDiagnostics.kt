package online.devnazu.books

import android.content.Context
import android.os.Build

/** Local-only crash shape: no exception messages, email, password, tokens or request bodies. */
object CrashDiagnostics {
    private var installed=false
    @Synchronized fun install(context:Context){
        if(installed)return
        installed=true
        val app=context.applicationContext
        val previous=Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler{thread,error->
            runCatching {
                val detail=buildString {
                    append("Nihongo Path Books ").append(BuildConfig.VERSION_NAME).append(" / API ").append(Build.VERSION.SDK_INT).append('\n')
                    var cause:Throwable?=error
                    repeat(4){
                        val current=cause
                        if(current!=null){append(current.javaClass.name).append('\n');current.stackTrace.take(14).forEach{append(it.className).append('.').append(it.methodName).append(':').append(it.lineNumber).append('\n')};cause=current.cause}
                    }
                }
                app.getSharedPreferences("crash_diagnostics",Context.MODE_PRIVATE).edit().putString("last",detail).commit()
            }
            if(previous!=null)previous.uncaughtException(thread,error) else {android.os.Process.killProcess(android.os.Process.myPid());kotlin.system.exitProcess(1)}
        }
    }
    fun summary(context:Context)=context.getSharedPreferences("crash_diagnostics",Context.MODE_PRIVATE).getString("last","")?:""
}
