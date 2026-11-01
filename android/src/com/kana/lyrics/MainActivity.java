package com.kana.lyrics;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import android.database.Cursor;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Hosts the study page in a WebView and adds what a plain web page cannot do. */
public class MainActivity extends Activity {
    private static final int REQ_FILE = 1, REQ_MIC = 2, REQ_NOTIFY = 3;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest pendingMic;
    private long lastBack;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xFFF6EFE4);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "AndroidApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            // "导入记录" picks a backup file from the phone
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "选择备份文件"), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            // microphone for the shadowing recorder
            // (anonymous classes instead of lambdas: compiling against android.jar has no LambdaMetafactory)
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(request.getResources());
                        } else {
                            pendingMic = request;
                            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
                        }
                    }
                });
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    // write the learning record right away when the app goes to the background (it may be killed later)
    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.evaluateJavascript("window.__flush && window.__flush()", null);
    }

    private static byte[] readAll(File f) throws Exception {
        byte[] b = new byte[(int) f.length()];
        try (FileInputStream in = new FileInputStream(f)) {
            int off = 0;
            while (off < b.length) { int n = in.read(b, off, b.length - off); if (n < 0) break; off += n; }
        }
        return b;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request == REQ_FILE && fileCallback != null) {
            Uri[] picked = null;
            if (result == RESULT_OK && data != null && data.getData() != null) picked = new Uri[]{data.getData()};
            fileCallback.onReceiveValue(picked);
            fileCallback = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        if (request == REQ_MIC && pendingMic != null) {
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED) pendingMic.grant(pendingMic.getResources());
            else pendingMic.deny();
            pendingMic = null;
        }
    }

    // back closes whatever is open in the page first; on the home screen it needs two presses to exit
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__appBack ? String(window.__appBack()) : 'false'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                if (value != null && value.contains("true")) return;
                long now = System.currentTimeMillis();
                if (now - lastBack < 2000) {
                    finish();
                } else {
                    lastBack = now;
                    Toast.makeText(MainActivity.this, "再按一次返回键退出", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /** Called from the page as window.AndroidApp.* */
    public class Bridge {
        @JavascriptInterface
        public boolean isApp() { return true; }

        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        /** Saves a backup into Downloads/五十音 and returns where it went (or "ERR:..."). */
        @JavascriptInterface
        public String saveFile(String name, String text) {
            try {
                byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/五十音");
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    try (OutputStream os = getContentResolver().openOutputStream(u)) { os.write(bytes); }
                    return "下载/五十音/" + name;
                }
                File dir = new File(getExternalFilesDir(null), "backup");
                dir.mkdirs();
                File f = new File(dir, name);
                try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); }
                return f.getAbsolutePath();
            } catch (Exception e) {
                return "ERR:" + e.getMessage();
            }
        }

        /** id 1 = daily practice reminder, id 2 = bedtime review reminder. */
        @JavascriptInterface
        public void setReminder(int id, int hour, int minute, boolean on) {
            Reminder.schedule(MainActivity.this, id, hour, minute, on);
            if (on && Build.VERSION.SDK_INT >= 33
                    && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY);
                    }
                });
            }
        }

        @JavascriptInterface
        public String getReminder(int id) {
            return Reminder.describe(MainActivity.this, id);
        }

        /** The learning record lives in the app's own storage (no browser size limit). Written via a temp file. */
        @JavascriptInterface
        public String saveState(String json) {
            try {
                File tmp = new File(getFilesDir(), "state.json.tmp"), f = new File(getFilesDir(), "state.json");
                try (FileOutputStream os = new FileOutputStream(tmp)) { os.write(json.getBytes(StandardCharsets.UTF_8)); os.getFD().sync(); }
                if (!tmp.renameTo(f)) { f.delete(); if (!tmp.renameTo(f)) return "ERR:rename"; }
                return "OK";
            } catch (Exception e) {
                return "ERR:" + e.getMessage();
            }
        }

        @JavascriptInterface
        public String loadState() {
            try {
                File f = new File(getFilesDir(), "state.json");
                return f.exists() ? new String(readAll(f), StandardCharsets.UTF_8) : "";
            } catch (Exception e) {
                return "";
            }
        }

        /** Every answer, one line each, for fitting the memory model to this learner. */
        @JavascriptInterface
        public String appendLog(String lines) {
            try (FileOutputStream os = new FileOutputStream(new File(getFilesDir(), "log.tsv"), true)) {
                os.write(lines.getBytes(StandardCharsets.UTF_8));
                return "OK";
            } catch (Exception e) {
                return "ERR:" + e.getMessage();
            }
        }

        @JavascriptInterface
        public String readLog() {
            try {
                File f = new File(getFilesDir(), "log.tsv");
                return f.exists() ? new String(readAll(f), StandardCharsets.UTF_8) : "";
            } catch (Exception e) {
                return "";
            }
        }

        /** Weekly automatic backup into Downloads/五十音; only the newest 4 automatic ones are kept. */
        @JavascriptInterface
        public String autoBackup(String name, String text) {
            String where = saveFile(name, text);
            if (where.startsWith("ERR")) return where;
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    List<Long> ids = new ArrayList<Long>();
                    try (Cursor c = getContentResolver().query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                            new String[]{MediaStore.Downloads._ID},
                            MediaStore.Downloads.DISPLAY_NAME + " LIKE ? AND " + MediaStore.Downloads.RELATIVE_PATH + " LIKE ?",
                            new String[]{"五十音记录-自动%", Environment.DIRECTORY_DOWNLOADS + "/五十音%"},
                            MediaStore.Downloads.DATE_ADDED + " DESC")) {
                        while (c != null && c.moveToNext()) ids.add(c.getLong(0));
                    }
                    for (int i = 4; i < ids.size(); i++)
                        getContentResolver().delete(Uri.withAppendedPath(MediaStore.Downloads.EXTERNAL_CONTENT_URI, String.valueOf(ids.get(i))), null, null);
                } else {
                    File[] fs = new File(getExternalFilesDir(null), "backup").listFiles();
                    if (fs != null) {
                        List<File> auto = new ArrayList<File>();
                        for (File f : fs) if (f.getName().startsWith("五十音记录-自动")) auto.add(f);
                        java.util.Collections.sort(auto, new java.util.Comparator<File>() {
                            @Override public int compare(File a, File b) { return Long.compare(b.lastModified(), a.lastModified()); }
                        });
                        for (int i = 4; i < auto.size(); i++) auto.get(i).delete();
                    }
                }
            } catch (Exception ignored) { }
            return where;
        }

        /** One reminder when enough questions will be due (0 = cancel). */
        @JavascriptInterface
        public void setDueReminder(long atMillis, String text) {
            Reminder.scheduleDue(MainActivity.this, atMillis, text);
        }
    }
}
