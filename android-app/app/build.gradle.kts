plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
fun setting(key: String, fallback: String = "") = providers.environmentVariable(key).orNull?.takeIf { it.isNotBlank() } ?: fallback
val liveAds = setting("BOOKS_LIVE_ADS", "true").toBooleanStrict()
android {
    namespace = "online.devnazu.books"
    compileSdk = 36
    defaultConfig {
        applicationId = "online.devnazu.books"
        minSdk = 23
        targetSdk = 36
        versionCode = 16
        versionName = if (liveAds) "1.9.0" else "1.9.0-test"
        buildConfigField("String", "API_BASE", "\"${setting("BOOKS_API_URL", "https://vjygltfnrmyghlwyjtwu.supabase.co/functions/v1/nihongo-books-v1")}\"")
        buildConfigField("boolean", "LIVE_ADS", liveAds.toString())
        buildConfigField("String", "REWARDED_ID", "\"${if (liveAds) "ca-app-pub-3728341118830943/5055001578" else "ca-app-pub-3940256099942544/5224354917"}\"")
        manifestPlaceholders["admobAppId"] = if (liveAds) "ca-app-pub-3728341118830943~7145978290" else "ca-app-pub-3940256099942544~3347511713"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    signingConfigs {
        if (setting("ANDROID_KEYSTORE_PATH").isNotBlank()) create("production") {
            storeFile = file(setting("ANDROID_KEYSTORE_PATH"))
            storePassword = setting("ANDROID_STORE_PASSWORD")
            keyAlias = setting("ANDROID_KEY_ALIAS")
            keyPassword = setting("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (signingConfigs.findByName("production") != null) signingConfig = signingConfigs.getByName("production")
        }
    }
    buildFeatures { buildConfig = true }
    compileOptions { isCoreLibraryDesugaringEnabled = true; sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("generated/study-assets"))
}
val prepareReader by tasks.registering(Exec::class) {
    workingDir(rootDir.parentFile)
    commandLine("python3", "android-app/scripts/prepare_reader.py")
    inputs.dir(rootDir.resolve("scripts"))
    outputs.upToDateWhen { false }
    outputs.dir(layout.buildDirectory.dir("generated/study-assets"))
}
tasks.named("preBuild").configure { dependsOn(prepareReader) }
dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.fragment:fragment-ktx:1.8.9")
    implementation("androidx.webkit:webkit:1.13.0")
    implementation("com.google.android.gms:play-services-ads:24.5.0")
    implementation("com.google.android.ump:user-messaging-platform:3.2.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
