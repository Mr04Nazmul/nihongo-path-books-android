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
        super(context, "adaptive-learning.db", null, 2);
    }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE attempts (owner TEXT NOT NULL, id TEXT NOT NULL, at INTEGER NOT NULL, scope TEXT NOT NULL, event TEXT NOT NULL, pending INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(owner,id))");
        db.execSQL("CREATE INDEX attempts_order ON attempts(owner,scope,at,id)");
        db.execSQL("CREATE TABLE sync_cursors (owner TEXT PRIMARY KEY, cursor TEXT NOT NULL)");
        db.execSQL("CREATE INDEX attempts_pending ON attempts(owner,pending,at,id)");
    }

    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        if (oldVersion != 1) throw new IllegalStateException("Unknown adaptive history version");
        db.execSQL("ALTER TABLE attempts ADD COLUMN pending INTEGER NOT NULL DEFAULT 1");
        db.execSQL("CREATE TABLE sync_cursors (owner TEXT PRIMARY KEY, cursor TEXT NOT NULL)");
        db.execSQL("CREATE INDEX attempts_pending ON attempts(owner,pending,at,id)");
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
            String variant = input.optString("variant");
            double difficulty = "reading".equals(variant) ? 0.2 : "reverse".equals(variant) ? 0.35 : 0;
            event.put("difficulty", difficulty).put("guess", 0.25).put("slip", 0.05);
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

    String sessionStarts(String owner, long now) {
        JSONArray sessions = new JSONArray();
        long previous = Long.MIN_VALUE;
        try (Cursor cursor = getReadableDatabase().rawQuery(
                "SELECT at FROM (SELECT at FROM attempts WHERE owner=? AND at>=? ORDER BY at DESC LIMIT 5000) ORDER BY at",
                new String[] {owner, String.valueOf(now - 90L * 86400000)})) {
            while (cursor.moveToNext()) {
                long at = cursor.getLong(0);
                if (at > now) break;
                if (previous == Long.MIN_VALUE || at - previous >= 30 * 60000) sessions.put(at);
                previous = at;
            }
        }
        return sessions.toString();
    }

    JSONObject syncRequest(String owner) throws JSONException {
        SQLiteDatabase db = getReadableDatabase();
        JSONArray events = new JSONArray();
        String after = "0";
        try (Cursor cursor = db.rawQuery("SELECT cursor FROM sync_cursors WHERE owner=?", new String[] {owner})) {
            if (cursor.moveToFirst()) after = cursor.getString(0);
        }
        try (Cursor cursor = db.rawQuery(
                "SELECT event FROM attempts WHERE owner=? AND pending=1 ORDER BY at,id LIMIT 32",
                new String[] {owner})) {
            while (cursor.moveToNext()) events.put(new JSONObject(cursor.getString(0)));
        }
        return new JSONObject().put("after", after).put("events", events);
    }

    void applySync(String owner, JSONObject request, JSONArray received) throws JSONException {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            String after = request.getString("after");
            long previous = Long.parseLong(after);
            for (int i = 0; i < received.length(); i++) {
                JSONObject row = received.getJSONObject(i);
                JSONObject event = row.getJSONObject("event");
                String id = UUID.fromString(event.getString("id")).toString();
                String item = event.getString("item");
                String[] parts = item.split(":", 4);
                String cursor = row.getString("cursor");
                long cursorValue = Long.parseLong(cursor);
                if (cursorValue <= previous || parts.length != 4 || !parts[0].matches("N[1-5]")
                        || !parts[1].matches("preview|full") || !parts[2].matches("vocab|grammar|kanji")
                        || !item.equals(event.getString("skill"))
                        || !Double.isFinite(event.getDouble("difficulty"))
                        || event.getDouble("guess") != 0.25 || event.getDouble("slip") != 0.05
                        || event.getInt("rating") != (event.getBoolean("correct") ? 3 : 1)) {
                    throw new JSONException("Invalid synced adaptive event");
                }
                ContentValues values = new ContentValues();
                values.put("owner", owner);
                values.put("id", id);
                values.put("at", event.getLong("at"));
                values.put("scope", parts[0] + ":" + parts[1] + ":");
                values.put("event", event.toString());
                values.put("pending", 0);
                db.insertWithOnConflict("attempts", null, values, SQLiteDatabase.CONFLICT_IGNORE);
                previous = cursorValue;
                after = cursor;
            }
            JSONArray sent = request.getJSONArray("events");
            ContentValues acknowledged = new ContentValues();
            acknowledged.put("pending", 0);
            for (int i = 0; i < sent.length(); i++) {
                db.update("attempts", acknowledged, "owner=? AND id=?",
                    new String[] {owner, sent.getJSONObject(i).getString("id")});
            }
            ContentValues values = new ContentValues();
            values.put("owner", owner);
            values.put("cursor", after);
            db.insertWithOnConflict("sync_cursors", null, values, SQLiteDatabase.CONFLICT_REPLACE);
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    void deleteOwner(String owner) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("attempts", "owner=?", new String[] {owner});
            db.delete("sync_cursors", "owner=?", new String[] {owner});
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }
}
