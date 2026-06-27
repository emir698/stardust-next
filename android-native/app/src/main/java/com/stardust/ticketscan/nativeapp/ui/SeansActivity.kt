package com.stardust.ticketscan.nativeapp.ui

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.stardust.ticketscan.nativeapp.R
import com.stardust.ticketscan.nativeapp.data.BiletDoc
import com.stardust.ticketscan.nativeapp.data.FirebaseRepository
import com.stardust.ticketscan.nativeapp.data.Gate
import com.stardust.ticketscan.nativeapp.data.SeansHelpers
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class SeansActivity : AppCompatActivity() {

    private lateinit var seansListContainer: LinearLayout
    private lateinit var gunText: TextView
    private lateinit var noEventText: TextView
    private lateinit var gateBadge: TextView

    private var biletler: Map<String, BiletDoc> = emptyMap()
    private var selectedGun: String = ""
    private lateinit var userName: String
    private lateinit var userRole: String
    private var gate: Gate = Gate.GENEL

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_seans)

        userName = intent.getStringExtra("userName") ?: ""
        userRole = intent.getStringExtra("userRole") ?: ""
        gate = GatePrefs.get(this) ?: Gate.GENEL

        seansListContainer = findViewById(R.id.seansListContainer)
        gunText = findViewById(R.id.gunText)
        noEventText = findViewById(R.id.noEventText)
        gateBadge = findViewById(R.id.gateBadge)
        updateGateBadge()
        gateBadge.setOnClickListener {
            startActivity(Intent(this, GateSelectActivity::class.java).apply {
                putExtra("userName", userName)
                putExtra("userRole", userRole)
            })
        }

        findViewById<Button>(R.id.logoutButton).setOnClickListener {
            FirebaseRepository.logout()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        selectedGun = SeansHelpers.resolveInitialGun()
        gunText.text = SeansHelpers.fmtDate(selectedGun)

        lifecycleScope.launch {
            FirebaseRepository.watchBiletler().collect { map ->
                biletler = map
                renderSeansList()
            }
        }
        renderSeansList()
    }

    private fun updateGateBadge() {
        gateBadge.text = if (gate == Gate.GENEL) "Ön Giriş" else "Giriş"
    }

    private fun renderSeansList() {
        val saatler = SeansHelpers.getSaatler(selectedGun) ?: emptyList()
        seansListContainer.removeAllViews()
        noEventText.visibility = if (saatler.isEmpty()) TextView.VISIBLE else TextView.GONE

        for (saat in saatler) {
            val item = LayoutInflater.from(this).inflate(R.layout.item_seans_card, seansListContainer, false)
            item.findViewById<TextView>(R.id.saatText).text = saat
            item.findViewById<TextView>(R.id.tarihText).text = selectedGun
            val stat = FirebaseRepository.getSeansIstatistik(biletler, selectedGun, saat)
            val statText = item.findViewById<TextView>(R.id.statText)
            if (stat.toplam > 0) {
                statText.visibility = TextView.VISIBLE
                statText.text = "${stat.giris} / ${stat.toplam} giriş yapıldı"
            }
            item.setOnClickListener {
                startActivity(Intent(this, ScanActivity::class.java).apply {
                    putExtra("userName", userName)
                    putExtra("userRole", userRole)
                    putExtra("selectedGun", selectedGun)
                    putExtra("selectedSeans", saat)
                    putExtra("gate", gate.name)
                })
            }
            seansListContainer.addView(item)
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-read the gate too — staff may have just changed it via the badge.
        gate = GatePrefs.get(this) ?: Gate.GENEL
        updateGateBadge()
        // Coming back from ScanActivity ("Geri") — re-resolve in case the
        // day rolled over while the scanner was on the scan screen.
        val freshGun = SeansHelpers.resolveInitialGun()
        if (freshGun != selectedGun) {
            selectedGun = freshGun
            gunText.text = SeansHelpers.fmtDate(selectedGun)
        }
        renderSeansList()
    }
}
