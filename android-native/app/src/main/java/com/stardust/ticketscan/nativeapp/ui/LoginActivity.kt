package com.stardust.ticketscan.nativeapp.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.stardust.ticketscan.nativeapp.R
import com.stardust.ticketscan.nativeapp.data.FirebaseRepository
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var emailInput: EditText
    private lateinit var passwordInput: EditText
    private lateinit var errorText: TextView
    private lateinit var loginButton: Button
    private lateinit var loginProgress: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        emailInput = findViewById(R.id.emailInput)
        passwordInput = findViewById(R.id.passwordInput)
        errorText = findViewById(R.id.errorText)
        loginButton = findViewById(R.id.loginButton)
        loginProgress = findViewById(R.id.loginProgress)

        loginButton.setOnClickListener { attemptLogin() }

        // Already-logged-in (and still valid) session — skip straight to seans selection.
        lifecycleScope.launch {
            val user = FirebaseRepository.resolveCurrentUser()
            if (user != null) goToSeans(user.name, user.role)
        }
    }

    private fun attemptLogin() {
        val email = emailInput.text.toString().trim()
        val password = passwordInput.text.toString()
        if (email.isEmpty() || password.isEmpty()) {
            showError("E-posta ve şifre gerekli")
            return
        }
        setLoading(true)
        lifecycleScope.launch {
            try {
                val user = FirebaseRepository.login(email, password)
                goToSeans(user.name, user.role)
            } catch (e: Exception) {
                showError(e.message ?: "Giriş başarısız")
            } finally {
                setLoading(false)
            }
        }
    }

    private fun goToSeans(name: String, role: String) {
        startActivity(Intent(this, SeansActivity::class.java).apply {
            putExtra("userName", name)
            putExtra("userRole", role)
        })
        finish()
    }

    private fun showError(msg: String) {
        errorText.text = msg
        errorText.visibility = TextView.VISIBLE
    }

    private fun setLoading(loading: Boolean) {
        loginButton.isEnabled = !loading
        loginProgress.visibility = if (loading) ProgressBar.VISIBLE else ProgressBar.GONE
        if (loading) errorText.visibility = TextView.GONE
    }
}
