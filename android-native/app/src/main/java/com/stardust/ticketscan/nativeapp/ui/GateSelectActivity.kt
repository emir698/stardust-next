package com.stardust.ticketscan.nativeapp.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.stardust.ticketscan.nativeapp.R
import com.stardust.ticketscan.nativeapp.data.Gate

/**
 * Lets staff pick which physical checkpoint this device is running as.
 * Remembered in SharedPreferences so the same device doesn't have to
 * re-pick it every login — but always reachable again (see the small
 * gate switcher in ScanActivity's top bar) in case a device needs to be
 * repurposed.
 */
object GatePrefs {
    private const val PREFS = "gate_prefs"
    private const val KEY_GATE = "selected_gate"

    fun get(context: Context): Gate? {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_GATE, null)
        return raw?.let { runCatching { Gate.valueOf(it) }.getOrNull() }
    }

    fun set(context: Context, gate: Gate) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_GATE, gate.name)
            .apply()
    }
}

class GateSelectActivity : AppCompatActivity() {

    private var userName: String = ""
    private var userRole: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_gate_select)

        userName = intent.getStringExtra("userName") ?: ""
        userRole = intent.getStringExtra("userRole") ?: ""

        findViewById<android.widget.LinearLayout>(R.id.genelCard).setOnClickListener {
            selectGate(Gate.GENEL)
        }
        findViewById<android.widget.LinearLayout>(R.id.ormanCard).setOnClickListener {
            selectGate(Gate.ORMAN)
        }
    }

    private fun selectGate(gate: Gate) {
        GatePrefs.set(this, gate)
        startActivity(Intent(this, SeansActivity::class.java).apply {
            putExtra("userName", userName)
            putExtra("userRole", userRole)
        })
        finish()
    }
}
