package com.bbqtown.dickson.ops

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ProgressBar
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var offlineMessage: TextView

    companion object {
        private const val HOME_URL = "https://bbqtowndickson.com/ops.html"
        private const val ALLOWED_HOST = "bbqtowndickson.com"
        private val BLOCKED_PREFIXES = listOf(
            "/book",
            "/reservations",
            "/voucher",
            "/vouchers"
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)
        webView = WebView(this)
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal)
        offlineMessage = TextView(this).apply {
            text = "Unable to connect to BBQ Town Ops.\nCheck Wi-Fi / internet and tap to retry."
            textSize = 17f
            gravity = android.view.Gravity.CENTER
            setPadding(32, 32, 32, 32)
            setBackgroundColor(Color.rgb(245, 244, 239))
            setTextColor(Color.rgb(23, 32, 24))
            visibility = View.GONE
            setOnClickListener { webView.reload() }
        }

        root.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        root.addView(progress, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 6))
        root.addView(offlineMessage, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            userAgentString = "$userAgentString BBQTownOpsAndroid/1.0"
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress >= 100) View.GONE else View.VISIBLE
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                val host = uri.host?.lowercase().orEmpty()
                val path = uri.path.orEmpty()

                if (host != ALLOWED_HOST && host != "www.$ALLOWED_HOST") {
                    return true
                }

                if (BLOCKED_PREFIXES.any { path.startsWith(it) }) {
                    view.loadUrl(HOME_URL)
                    return true
                }

                return false
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                offlineMessage.visibility = View.GONE
                val script = """
                    (function(){
                      const hide = (el) => { if (el) el.style.setProperty('display','none','important'); };
                      hide(document.getElementById('bookingLink'));
                      document.querySelectorAll('a[href="/vouchers"],a[href^="/voucher"],a[href^="/reservations"],a[href^="/book"]').forEach(hide);
                      const brand = document.getElementById('brandSub');
                      if (brand && !brand.textContent.includes('App')) brand.textContent = brand.textContent + ' · App';
                    })();
                """.trimIndent()
                view.evaluateJavascript(script, null)
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) {
                    offlineMessage.visibility = View.VISIBLE
                }
            }
        }

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
