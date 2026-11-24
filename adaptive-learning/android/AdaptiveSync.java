package online.devnazu.books;

import org.json.JSONArray;
import org.json.JSONObject;

final class AdaptiveSync {
    static void run(MainActivity activity, String owner, String credential) {
        if (!BuildConfig.ADAPTIVE_SYNC || credential.isEmpty() || owner.equals("guest")) return;
        MainActivity.access$getSyncWorker$p(activity).execute(() -> {
            AdaptiveHistory history = AdaptiveHistory.get(activity);
            try {
                for (int page = 0; page < 8; page++) {
                    if (!matches(activity, owner, credential)) return;
                    JSONObject request = history.syncRequest(owner);
                    JSONObject result = MainActivity.access$getApi$p(activity)
                        .requestWithCredential("/adaptive-sync", "POST", request, credential);
                    if (!matches(activity, owner, credential)) return;
                    JSONArray received = result.getJSONArray("events");
                    history.applySync(owner, request, received);
                    if (received.length() < 128 && request.getJSONArray("events").length() < 32) return;
                }
            } catch (Exception deferred) {
                android.util.Log.d("AdaptiveStudy", "Adaptive sync deferred");
            }
        });
    }

    private static boolean matches(MainActivity activity, String owner, String credential) {
        JSONObject user = MainActivity.access$getData$p(activity).optJSONObject("user");
        return user != null && owner.equals(user.optString("id"))
            && credential.equals(MainActivity.access$getVault$p(activity).read());
    }

    private AdaptiveSync() {}
}
