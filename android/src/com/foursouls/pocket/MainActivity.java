package com.foursouls.pocket;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

/** Packages the shared React app; game rules remain in the TypeScript engine. */
public final class MainActivity extends Activity {
    private static final String ASSET_PATH = "/pocket-native/";
    private static final Uri SERVER = Uri.parse(ServerConfig.ORIGIN);
    private WebView web;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
            getWindow().setAttributes(params);
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(20, 23, 17));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new LocalAssetsClient());
        setContentView(web);
        web.loadUrl(ServerConfig.ORIGIN + ASSET_PATH + "index.html");
        immersive();
    }

    private final class LocalAssetsClient extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(
                WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String path = uri.getPath();
            if (!"https".equals(uri.getScheme())
                    || !SERVER.getAuthority().equals(uri.getAuthority())
                    || path == null || !path.startsWith(ASSET_PATH)) {
                return null; // API calls use the real HTTPS server, without interception.
            }
            String asset = path.substring(ASSET_PATH.length());
            if (asset.contains("..") || asset.contains("\\")) {
                return notFound();
            }
            try {
                return new WebResourceResponse(mimeType(asset), "UTF-8", 200, "OK",
                        Collections.singletonMap("Cache-Control", "no-cache"),
                        getAssets().open("web/" + asset));
            } catch (IOException error) {
                return notFound();
            }
        }

        @Override public boolean shouldOverrideUrlLoading(
                WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                try {
                    startActivity(intent);
                } catch (android.content.ActivityNotFoundException error) {
                    new AlertDialog.Builder(MainActivity.this)
                            .setMessage("No hay un navegador disponible para abrir el enlace.")
                            .setPositiveButton("Aceptar", null).show();
                }
            }
            return true;
        }
    }

    private static String mimeType(String filename) {
        if (filename.endsWith(".js")) return "text/javascript";
        if (filename.endsWith(".css")) return "text/css";
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".html")) return "text/html";
        return "application/octet-stream";
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override public void onWindowFocusChanged(boolean focus) {
        super.onWindowFocusChanged(focus);
        if (focus) immersive();
    }

    @Override protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override public void onBackPressed() {
        new AlertDialog.Builder(this)
                .setMessage("¿Salir? Tu partida de solitario se guarda automáticamente.")
                .setNegativeButton("Seguir jugando", null)
                .setPositiveButton("Salir", (dialog, which) -> finish()).show();
    }

    @Override protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
