# JavaScript calls these annotated native methods by name. Keep the bridge
# methods while allowing the rest of the application to be optimized.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
# Preserve useful source locations in retraced release crash reports.
-keepattributes SourceFile,LineNumberTable
