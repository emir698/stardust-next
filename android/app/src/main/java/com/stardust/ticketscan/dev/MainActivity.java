package com.stardust.ticketscan.dev;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.inputmethod.InputMethodManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

/**
 * Native WebView shell for the standalone scan tool at
 * https://emir698.github.io/stardust/scan.html — a separate static-HTML
 * project from stardustticket.com, with its own login UI built into the
 * same page (no separate /login route to worry about).
 *
 * This replaces the old TWA wrapper (which pointed at stardustticket.com)
 * and the earlier native-WebView attempt that mistakenly also pointed at
 * stardustticket.com. Direct access to real Android APIs here is what
 * lets us reliably control the soft keyboard around the Honeywell HID
 * barcode scanner without affecting how the scanner's hardware key
 * events are delivered.
 */
public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://emir698.github.io/stardust/scan.html";
    private static final String ALLOWED_HOST = "emir698.github.io";
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

        // Bridge so scan.html can call native Android APIs (e.g. to
        // dismiss the soft keyboard right after focusing #barcodeHidden)
        // without affecting hardware key delivery from the Honeywell
        // scanner.
        webView.addJavascriptInterface(new AndroidBridge(), "Android");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && host.equals(ALLOWED_HOST)) {
                    return false; // let the WebView load it
                }
                // External link -> hand off to the OS instead of navigating away in-app
                try {
                    startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) {
                    // No app can handle it; ignore rather than crash
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // scan.html's QR flow calls getUserMedia(); route that
                // through Android's runtime permission system.
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

    /** JS-callable bridge exposed as `window.Android` in scan.html. */
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
