package com.kana.lyrics;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.Calendar;

/** Daily reminders (practice / bedtime review); survives reboots. */
public class Reminder extends BroadcastReceiver {
    private static final String CHANNEL = "practice";
    private static final String PREFS = "reminders";

    static void schedule(Context c, int id, int hour, int minute, boolean on) {
        c.getSharedPreferences(PREFS, 0).edit()
                .putInt("h" + id, hour).putInt("m" + id, minute).putBoolean("on" + id, on).apply();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(c, id, new Intent(c, Reminder.class).putExtra("id", id),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        if (!on) return;
        Calendar t = Calendar.getInstance();
        t.set(Calendar.HOUR_OF_DAY, hour);
        t.set(Calendar.MINUTE, minute);
        t.set(Calendar.SECOND, 0);
        if (t.getTimeInMillis() <= System.currentTimeMillis()) t.add(Calendar.DAY_OF_MONTH, 1);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, t.getTimeInMillis(), AlarmManager.INTERVAL_DAY, pi);
    }

    /** id 3: a one-off reminder at the moment enough reviews have piled up (computed by the page). */
    static void scheduleDue(Context c, long at, String text) {
        c.getSharedPreferences(PREFS, 0).edit().putLong("dueAt", at).putString("dueText", text).apply();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = PendingIntent.getBroadcast(c, 3, new Intent(c, Reminder.class).putExtra("id", 3),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        if (at > System.currentTimeMillis()) am.set(AlarmManager.RTC_WAKEUP, at, pi);
    }

    /** "on,hour,minute" so the page can show the current setting. */
    static String describe(Context c, int id) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, 0);
        return sp.getBoolean("on" + id, false) + "," + sp.getInt("h" + id, id == 2 ? 22 : 20) + "," + sp.getInt("m" + id, 0);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            SharedPreferences sp = c.getSharedPreferences(PREFS, 0);
            for (int id = 1; id <= 2; id++) {
                if (sp.getBoolean("on" + id, false)) schedule(c, id, sp.getInt("h" + id, 20), sp.getInt("m" + id, 0), true);
            }
            if (sp.getLong("dueAt", 0) > System.currentTimeMillis()) scheduleDue(c, sp.getLong("dueAt", 0), sp.getString("dueText", ""));
            return;
        }
        int id = intent.getIntExtra("id", 1);
        String dueText = id == 3 ? c.getSharedPreferences(PREFS, 0).getString("dueText", "") : "";
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "练习提醒", NotificationManager.IMPORTANCE_DEFAULT));
        }
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle(id == 3 ? "该复习啦" : id == 2 ? "睡前复习 10 分钟" : "该练五十音啦")
                .setContentText(id == 3 ? dueText : id == 2 ? "睡前复习一轮，睡觉时大脑会帮你巩固" : "今天的目标在等你，打开刷一会儿")
                .setAutoCancel(true)
                .setContentIntent(open);
        nm.notify(id, b.build());
    }
}
