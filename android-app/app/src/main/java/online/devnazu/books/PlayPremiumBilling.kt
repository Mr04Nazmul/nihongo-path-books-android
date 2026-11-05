package online.devnazu.books

import android.app.Activity
import com.android.billingclient.api.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Google owns checkout/prices; the server alone grants access and acknowledges purchases. */
class PlayPremiumBilling(private val activity:Activity,private val session:()->String,private val owner:()->String?,private val message:(String)->Unit,private val refreshed:()->Unit):PurchasesUpdatedListener {
    companion object { const val PRODUCT="nihongo_premium"; const val PLAN="monthly" }
    private val worker=Executors.newSingleThreadExecutor()
    private val http=OkHttpClient.Builder().connectTimeout(15,TimeUnit.SECONDS).readTimeout(45,TimeUnit.SECONDS).followRedirects(false).build()
    private var closed=false
    private var connecting=false
    private var product:ProductDetails?=null
    private val client=BillingClient.newBuilder(activity).setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection().build()
    private fun ui(action:()->Unit){activity.runOnUiThread{if(!closed&&!activity.isDestroyed)action()}}
    fun connect(){
        if(closed)return
        if(client.isReady){restore();return}
        if(connecting)return
        connecting=true
        client.startConnection(object:BillingClientStateListener {
            override fun onBillingSetupFinished(result:BillingResult){connecting=false;if(result.responseCode==BillingClient.BillingResponseCode.OK){load();restore()}else ui{message("Google Play Billing is unavailable. Try again later.")}}
            override fun onBillingServiceDisconnected(){connecting=false}
        })
    }
    private fun load(){client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(listOf(
        QueryProductDetailsParams.Product.newBuilder().setProductId(PRODUCT).setProductType(BillingClient.ProductType.SUBS).build()
    )).build()){result,details->if(result.responseCode==BillingClient.BillingResponseCode.OK)product=details.productDetailsList.firstOrNull{it.productId==PRODUCT}}}
    private fun offer()=product?.subscriptionOfferDetails?.firstOrNull{it.basePlanId==PLAN&&it.offerId==null}
    fun price():String?=offer()?.pricingPhases?.pricingPhaseList?.lastOrNull()?.formattedPrice
    fun purchase(){
        val id=owner();val credential=session()
        if(id.isNullOrBlank()||credential.isEmpty()){message("Please sign in before subscribing.");return}
        val p=product;val offer=offer()
        if(!client.isReady||p==null||offer==null){connect();message("The monthly plan is not available yet. No payment has been made.");return}
        // Fail closed if verification is not configured. Never send a buyer to an unconfigured checkout.
        worker.execute{runCatching{request("/status",credential)}.onSuccess{ui{
            if(owner()!=id||session()!=credential)return@ui
            val result=client.launchBillingFlow(activity,BillingFlowParams.newBuilder().setObfuscatedAccountId(id)
                .setProductDetailsParamsList(listOf(BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(p).setOfferToken(offer.offerToken).build())).build())
            if(result.responseCode!=BillingClient.BillingResponseCode.OK)message("Google Play checkout could not open. Please try again.")
        }}.onFailure{ui{message(it.message?:"Billing setup is pending.")}}}
    }
    fun restore(){
        if(closed||!client.isReady||owner().isNullOrBlank())return
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()){result,purchases->
            if(result.responseCode==BillingClient.BillingResponseCode.OK)purchases.filter{PRODUCT in it.products}.forEach{verify(it)}
        }
    }
    override fun onPurchasesUpdated(result:BillingResult,purchases:MutableList<Purchase>?){
        when(result.responseCode){
            BillingClient.BillingResponseCode.OK->purchases?.filter{PRODUCT in it.products}?.forEach{verify(it)}
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED->restore()
            BillingClient.BillingResponseCode.USER_CANCELED->Unit
            else->ui{message("Payment could not finish. Restore purchases if payment was already completed.")}
        }
    }
    private fun verify(p:Purchase){
        if(p.purchaseState!=Purchase.PurchaseState.PURCHASED){ui{message("Payment is pending. Premium starts after Google confirms payment.")};return}
        val id=owner()?:return;val credential=session()
        worker.execute{runCatching{request("/verify",credential,JSONObject().put("purchaseToken",p.purchaseToken))}
            .onSuccess{r->ui{if(owner()==id&&session()==credential){message(if(r.optBoolean("active"))"Premium verified with Google Play." else "This subscription is no longer active.");refreshed()}}}
            .onFailure{ui{message(it.message?:"Verification is pending. Restore purchases to retry.")}}}
    }
    private fun request(path:String,credential:String,body:JSONObject=JSONObject()):JSONObject {
        val r=Request.Builder().url(BuildConfig.PLAY_BILLING_API+path).header("Authorization","Bearer "+credential)
            .post(body.toString().toRequestBody("application/json".toMediaType())).build()
        http.newCall(r).execute().use{response->val json=JSONObject(response.body?.string()?:"{}");check(response.isSuccessful){json.optString("error","Billing verification is unavailable")};return json}
    }
    fun close(){closed=true;client.endConnection();worker.shutdownNow();http.dispatcher.cancelAll()}
}
