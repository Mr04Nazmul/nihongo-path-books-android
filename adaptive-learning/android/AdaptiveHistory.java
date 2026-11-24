package online.devnazu.books;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.UUID;

final class AdaptiveHistory extends SQLiteOpenHelper {
    private static AdaptiveHistory instance;

    static synchronized AdaptiveHistory get(Context context) {
        if (instance == null) instance = new AdaptiveHistory(context.getApplicationContext());
        return instance;
    }

    private AdaptiveHistory(Context context) {
        super(context, "adaptive-learning.db", null, 1);
    }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE attempts (owner TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, scope TEXT NOT NULL, event TEXT NOT NULL, PRIMARY KEY(owner,id))");
        db.execSQL("CREATE INDEX attempts_order ON attempts(owner,scope,at,id)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("No adaptive history migration from " + oldVersion);
    }

    boolean append(String owner, String level, boolean preview, String raw) {
        if (raw == null || raw.length() > 1024 || level == null) return false;
        try {
            JSONObject input = new JSONObject(raw);
            String item = input.getString("item");
            String prefix = level + ":" + (preview ? "preview:" : "full:");
            if (!item.startsWith(prefix) || item.length() > 128) return false;
            String kind = item.substring(prefix.length()).split(":", 2)[0];
            if (!kind.matches("vocab|grammar|kanji")) return false;
            boolean correct = input.getBoolean("correct");
            double seconds = input.getDouble("seconds");
            if (!Double.isFinite(seconds) || seconds < 0) return false;
            JSONObject event = new JSONObject();
            String id = UUID.randomUUID().toString();
            long at = System.currentTimeMillis();
            event.put("id", id).put("at", at).put("item", item).put("skill", item);
            event.put("correct", correct).put("rating", correct ? 3 : 1);
            event.put("difficulty", 0).put("guess", 0.25).put("slip", 0.05);
            event.put("seconds", Math.max(1, Math.min(120, seconds)));
            ContentValues values = new ContentValues();
            values.put("owner", owner);
            values.put("id", id);
            values.put("at", at);
            values.put("scope", prefix);
            values.put("event", event.toString());
            return getWritableDatabase().insertOrThrow("attempts", null, values) != -1;
        } catch (JSONException | android.database.SQLException error) {
            return false;
        }
    }

    String recent(String owner, String prefix) {
        JSONArray events = new JSONArray();
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "SELECT event FROM attempts WHERE owner=? AND scope=? ORDER BY at DESC,id DESC LIMIT 12000",
                new String[] {owner, prefix})) {
            while (cursor.moveToNext()) events.put(new JSONObject(cursor.getString(0)));
            return events.toString();
        } catch (JSONException | android.database.SQLException error) {
            return "";
        }
    }

    void deleteOwner(String owner) {
        getWritableDatabase().delete("attempts", "owner=?", new String[] {owner});
    }
}
