package com.stardust.ticketscan.dev;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * Native WebView shell for stardustticket.com/scan.
 *
 * Replaces the previous TWA (Trusted Web Activity) wrapper. This gives us
 * direct access to real Android APIs (InputMethodManager, runtime
 * permissions, key event dispatch) instead of depending on Chrome /
 * Custom Tabs behavior — which is what we need to reliably control the
 * soft keyboard around the Honeywell HID barcode scanner without
 * affecting how the scanner's hardware key events are delivered.
 */
public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://stardustticket.com/scan";
    private static final String ALLOWED_HOST_SUFFIX = "stardustticket.com";
    private static final int CAMERA_PERMISSION_REQUEST = 1001;

    private WebView webView;
    private PermissionRequest pendingWebPermissionRequest;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        configureWebView();
        webView.loadUrl(START_URL);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Bridge so the web app can call native Android APIs (e.g. to
        // dismiss the soft keyboard right after focusing the barcode
        // input) without affecting hardware key delivery from the
        // Honeywell scanner.
        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.equals(ALLOWED_HOST_SUFFIX) || host.endsWith("." + ALLOWED_HOST_SUFFIX))) {
                    return false; // let the WebView load it
                }
                // External link (e.g. a "mailto:" or third-party URL) -> hand off to the OS
                try {
                    startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // No app can handle it; just ignore rather than crash
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // The QR camera flow calls getUserMedia() in the page;
                // route that through Android's runtime permission system.
                for (String resource : request.getResources()) {
                    if (resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        if (hasCameraPermission()) {
                            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                        } else {
                            pendingWebPermissionRequest = request;
                            ActivityCompat.requestPermissions(
                                MainActivity.this,
                                new String[]{Manifest.permission.CAMERA},
                                CAMERA_PERMISSION_REQUEST
                            );
                        }
                        return;
                    }
                }
                request.deny();
            }
        });
    }

    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST && pendingWebPermissionRequest != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) {
                pendingWebPermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                pendingWebPermissionRequest.deny();
            }
            pendingWebPermissionRequest = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /**
     * The Honeywell EDA51 internal scanner, when set to "Keyboard Wedge"
     * mode, delivers scans as real hardware KeyEvents. Those reach the
     * focused WebView/input the same way physical keyboard input does,
     * so we don't need to do anything special here for scanning itself —
     * this override exists only as a safety net in case a future build
     * needs to intercept a specific trigger key (e.g. a side scan
     * button) at the Activity level instead of in JS.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        return super.dispatchKeyEvent(event);
    }

    /** JS-callable bridge exposed as `window.Android` in the web app. */
    private class AndroidBridge {
        @android.webkit.JavascriptInterface
        public void hideKeyboard() {
            runOnUiThread(() -> {
                InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) {
                    imm.hideSoftInputFromWindow(webView.getWindowToken(), 0);
                }
            });
        }
    }
}
