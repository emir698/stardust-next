package com.stardust.ticketscan.nativeapp.ui

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.KeyEvent
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.stardust.ticketscan.nativeapp.R
import com.stardust.ticketscan.nativeapp.data.BiletDoc
import com.stardust.ticketscan.nativeapp.data.FirebaseRepository
import com.stardust.ticketscan.nativeapp.data.KurumsalPaket
import com.stardust.ticketscan.nativeapp.data.ResultSheetData
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@androidx.camera.core.ExperimentalGetImage
class ScanActivity : AppCompatActivity(), ResultSheetFragment.Listener {

    private lateinit var barcodeInput: EditText
    private lateinit var seansLabel: TextView
    private lateinit var statPill: TextView
    private lateinit var qrCard: FrameLayout
    private lateinit var cameraPreview: PreviewView
    private lateinit var qrStartButton: Button
    private lateinit var qrStopButton: Button
    private lateinit var toastText: TextView

    private lateinit var selectedGun: String
    private lateinit var selectedSeans: String
    private lateinit var userName: String
    private lateinit var userRole: String

    private var biletler: Map<String, BiletDoc> = emptyMap()
    private var kurumsalPaketler: Map<String, KurumsalPaket> = emptyMap()
    private var currentPnr: String? = null
    private var currentPnrPendingCount: Int = 0

    private var debounceJob: Job? = null
    private var cameraExecutor: ExecutorService? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var qrActive = false
    private var qrHandled = false // guards against double-trigger while frames are in flight

    private val cameraPermissionRequest = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) startQr() else showToast("Kamera izni gerekli", false) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_scan)

        userName = intent.getStringExtra("userName") ?: ""
        userRole = intent.getStringExtra("userRole") ?: ""
        selectedGun = intent.getStringExtra("selectedGun") ?: ""
        selectedSeans = intent.getStringExtra("selectedSeans") ?: ""

        barcodeInput = findViewById(R.id.barcodeInput)
        seansLabel = findViewById(R.id.seansLabel)
        statPill = findViewById(R.id.statPill)
        qrCard = findViewById(R.id.qrCard)
        cameraPreview = findViewById(R.id.cameraPreview)
        qrStartButton = findViewById(R.id.qrStartButton)
        qrStopButton = findViewById(R.id.qrStopButton)
        toastText = findViewById(R.id.toastText)

        seansLabel.text = selectedSeans

        // setShowSoftInputOnFocus(false) is the documented, correct API
        // for this — but on this Honeywell device it isn't fully
        // respected on its own. Belt-and-suspenders: also explicitly
        // hide the IME every time the field gains focus, and again when
        // the window itself gains focus (covers the keyboard popping up
        // on activity launch before our focus listener is even wired
        // up). None of this touches hardware key dispatch — the
        // Honeywell scanner's key events reach the EditText completely
        // independently of IME visibility.
        barcodeInput.setShowSoftInputOnFocus(false)
        barcodeInput.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) hideKeyboard()
        }
        barcodeInput.requestFocus()
        hideKeyboard()

        setupBarcodeInput()

        findViewById<Button>(R.id.backButton).setOnClickListener { finish() }
        findViewById<Button>(R.id.listeButton).setOnClickListener { openListe() }
        qrStartButton.setOnClickListener { requestCameraAndStart() }
        qrStopButton.setOnClickListener { stopQr() }

        lifecycleScope.launch {
            FirebaseRepository.watchBiletler().collect { map ->
                biletler = map
                updateStatPill()
            }
        }
        lifecycleScope.launch {
            FirebaseRepository.watchKurumsalPaketler().collect { map -> kurumsalPaketler = map }
        }
    }

    override fun onResume() {
        super.onResume()
        refocusBarcode()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            // Catches the case where the system tries to show the
            // keyboard as soon as the window actually becomes focused
            // (can happen on activity launch, before any user
            // interaction) — independent of the focus-change listener
            // above.
            hideKeyboard()
        }
    }

    private fun hideKeyboard() {
        val imm = getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
        imm.hideSoftInputFromWindow(barcodeInput.windowToken, 0)
        // This device's IME has shown up slightly *after* an immediate
        // hide call before — a couple of short delayed retries catch
        // that without any visible side effect when the keyboard was
        // never going to show in the first place.
        barcodeInput.postDelayed({ imm.hideSoftInputFromWindow(barcodeInput.windowToken, 0) }, 100)
        barcodeInput.postDelayed({ imm.hideSoftInputFromWindow(barcodeInput.windowToken, 0) }, 300)
    }

    private fun updateStatPill() {
        val stat = FirebaseRepository.getSeansIstatistik(biletler, selectedGun, selectedSeans)
        statPill.text = "${stat.giris}/${stat.toplam}"
    }

    // ── Barcode input (mirrors handleBarcodeInput / handleBarcodeKeyDown) ──

    private fun setupBarcodeInput() {
        barcodeInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                debounceJob?.cancel()
                val v = s?.toString()?.trim()?.uppercase() ?: return
                val shouldAutoSubmit = (v.startsWith("SD-") && v.length >= 10) ||
                    (v.startsWith("PNR-") && v.length >= 10) ||
                    (v.startsWith("KURUMSAL") && v.length >= 8)
                if (shouldAutoSubmit) {
                    debounceJob = lifecycleScope.launch {
                        delay(80)
                        submitBarcode(v)
                    }
                }
            }
        })

        barcodeInput.setOnEditorActionListener { _, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_DONE ||
                (event != null && event.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN)
            ) {
                debounceJob?.cancel()
                val v = barcodeInput.text.toString().trim().uppercase()
                if (v.length >= 4) submitBarcode(v)
                true
            } else false
        }

        // Hardware Enter key, for scanners that dispatch it directly rather
        // than through the IME action (covers both paths).
        barcodeInput.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN) {
                debounceJob?.cancel()
                val v = barcodeInput.text.toString().trim().uppercase()
                if (v.length >= 4) submitBarcode(v)
                true
            } else false
        }
    }

    private fun submitBarcode(v: String) {
        barcodeInput.setText("")
        refocusBarcode()
        lifecycleScope.launch { islemYap(v) }
    }

    private fun refocusBarcode() {
        barcodeInput.requestFocus()
        hideKeyboard()
    }

    // ── QR camera (CameraX + ML Kit) ────────────────────────────────────

    private fun requestCameraAndStart() {
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA)
            == android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            startQr()
        } else {
            cameraPermissionRequest.launch(android.Manifest.permission.CAMERA)
        }
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun startQr() {
        qrActive = true
        qrHandled = false
        qrStartButton.visibility = Button.GONE
        cameraPreview.visibility = PreviewView.VISIBLE
        qrStopButton.visibility = Button.VISIBLE

        cameraExecutor = Executors.newSingleThreadExecutor()
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener({
            val provider = providerFuture.get()
            cameraProvider = provider

            val preview = androidx.camera.core.Preview.Builder().build().also {
                it.setSurfaceProvider(cameraPreview.surfaceProvider)
            }

            val scannerOptions = BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build()
            val scanner = BarcodeScanning.getClient(scannerOptions)

            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(cameraExecutor!!) { imageProxy ->
                processQrFrame(imageProxy, scanner)
            }

            try {
                provider.unbindAll()
                provider.bindToLifecycle(
                    this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis
                )
            } catch (e: Exception) {
                showToast("Kamera açılamadı", false)
                stopQr()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.camera.core.ExperimentalGetImage
    private fun processQrFrame(imageProxy: ImageProxy, scanner: com.google.mlkit.vision.barcode.BarcodeScanner) {
        val mediaImage = imageProxy.image
        if (mediaImage == null || qrHandled) {
            imageProxy.close()
            return
        }
        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                val text = barcodes.firstOrNull()?.rawValue
                if (!text.isNullOrEmpty() && !qrHandled) {
                    qrHandled = true
                    val v = text.trim().uppercase()
                    stopQr()
                    lifecycleScope.launch { islemYap(v) }
                }
            }
            .addOnCompleteListener { imageProxy.close() }
    }

    private fun stopQr() {
        qrActive = false
        cameraProvider?.unbindAll()
        cameraExecutor?.shutdown()
        cameraExecutor = null
        cameraProvider = null
        qrStartButton.visibility = Button.VISIBLE
        cameraPreview.visibility = PreviewView.GONE
        qrStopButton.visibility = Button.GONE
    }

    // ── Core scan logic ──────────────────────────────────────────────────

    private suspend fun islemYap(v: String) {
        val result = FirebaseRepository.islemYap(v, kurumsalPaketler, selectedGun, selectedSeans)
        when (result) {
            is FirebaseRepository.ScanResult.Result -> openResultSheet(result.sheet)
            is FirebaseRepository.ScanResult.PNRFound -> {
                currentPnr = result.pnr
                currentPnrPendingCount = result.bekleyenler.size
                openResultSheet(result.sheet)
            }
        }
    }

    private fun openResultSheet(data: ResultSheetData) {
        val fragment = ResultSheetFragment.newInstance(data)
        fragment.listener = this
        fragment.show(supportFragmentManager, "result")

        // Auto-dismiss success/already-final results after a beat, matching
        // the web app's setTimeout(() => closeSheet(), 3000) on plain
        // valid-scan / kurumsal results (anything that doesn't need the
        // "Giriş Ver" confirmation step).
        if (!data.showGiris) {
            lifecycleScope.launch {
                delay(3000)
                if (fragment.isAdded) fragment.dismiss()
            }
        }
    }

    private fun openListe() {
        lifecycleScope.launch {
            val kisiler = FirebaseRepository.fetchListeKisiler(selectedGun, selectedSeans, biletler)
            ListeSheetFragment.newInstance(selectedGun, selectedSeans, kisiler)
                .show(supportFragmentManager, "liste")
        }
    }

    // ── ResultSheetFragment.Listener ─────────────────────────────────────

    override fun onGirisVer(secilenler: List<String>) {
        lifecycleScope.launch {
            FirebaseRepository.girisVer(currentPnr ?: "", secilenler)
            val pnr = currentPnr
            if (pnr != null && secilenler.size >= currentPnrPendingCount) {
                // Every pending ticket on this PNR was given entry — mark
                // the PNR record itself as fully used too, matching the
                // web app's behavior.
                FirebaseRepository.markPnrFullyUsed(pnr)
            }
            showToast("✓ ${secilenler.size} bilete giriş verildi!", true)
        }
    }

    override fun onSheetDismissed() {
        currentPnr = null
        currentPnrPendingCount = 0
        refocusBarcode()
    }

    // ── Toast ─────────────────────────────────────────────────────────────

    private var toastJob: Job? = null
    private fun showToast(msg: String, ok: Boolean) {
        toastJob?.cancel()
        toastText.text = msg
        toastText.visibility = TextView.VISIBLE
        toastJob = lifecycleScope.launch {
            delay(2500)
            toastText.visibility = TextView.GONE
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopQr()
    }
}
