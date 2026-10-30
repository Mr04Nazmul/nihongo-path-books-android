package online.devnazu.books

import android.app.Activity
import com.google.android.gms.ads.*
import com.google.android.gms.ads.rewarded.*
import com.google.android.ump.*

class RewardAds(private val activity: Activity) {
    private val consent by lazy {UserMessagingPlatform.getConsentInformation(activity)}
    private var busy=false
    private fun active()=!activity.isDestroyed&&!activity.isFinishing
    private fun updateConsent(done: () -> Unit, failed: () -> Unit) {
        if(!active()){failed();return}
        try {
            consent.requestConsentInfoUpdate(activity,ConsentRequestParameters.Builder().build(),{
                if(!active()){failed();return@requestConsentInfoUpdate}
                try{UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity){if(active())done()else failed()}}catch(_:Exception){failed()}
            },{if(active()&&consent.canRequestAds())done()else failed()})
        }catch(_:Exception){failed()}
    }
    fun privacy(done: () -> Unit) {
        updateConsent({if(active())try{UserMessagingPlatform.showPrivacyOptionsForm(activity){done()}}catch(_:Exception){done()}},{done()})
    }
    fun show(sessionId: String, userId: String, status: (String) -> Unit, finished: () -> Unit) {
        if(busy||!active())return
        busy=true
        val unavailable={busy=false;if(active())status("Ads are unavailable now. No credits were deducted.")}
        status(if(BuildConfig.LIVE_ADS) "বিজ্ঞাপন প্রস্তুত হচ্ছে…" else "Preparing a Google test advertisement…")
        // Consent and the advertising SDK start only after the user requests an ad.
        updateConsent({
            if(!active()||!consent.canRequestAds()){unavailable();return@updateConsent}
            try{MobileAds.initialize(activity) {
                activity.runOnUiThread {
                    if(!active()){busy=false;return@runOnUiThread}
                    try{RewardedAd.load(activity,BuildConfig.REWARDED_ID,AdRequest.Builder().build(),object:RewardedAdLoadCallback(){
                        override fun onAdFailedToLoad(error:LoadAdError){unavailable()}
                        override fun onAdLoaded(ad:RewardedAd){
                            if(!active()){busy=false;return}
                            try{
                                ad.setServerSideVerificationOptions(ServerSideVerificationOptions.Builder().setUserId(userId).setCustomData(sessionId).build())
                                ad.fullScreenContentCallback=object:FullScreenContentCallback(){
                                    override fun onAdDismissedFullScreenContent(){busy=false;if(active())finished()}
                                    override fun onAdFailedToShowFullScreenContent(error:AdError){unavailable()}
                                }
                                ad.show(activity) {if(active())status("বিজ্ঞাপন সম্পূর্ণ হয়েছে। সার্ভার যাচাইয়ের পর ১ ক্রেডিট যোগ হবে…")}
                                // Only a verified server callback can issue credits.
                            }catch(_:Exception){unavailable()}
                        }
                    })}catch(_:Exception){unavailable()}
                }
            }}catch(_:Exception){unavailable()}
        },unavailable)
    }
}
