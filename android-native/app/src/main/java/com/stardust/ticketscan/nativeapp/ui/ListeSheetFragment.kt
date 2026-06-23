package com.stardust.ticketscan.nativeapp.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.stardust.ticketscan.nativeapp.R
import com.stardust.ticketscan.nativeapp.data.ListeKisi

class ListeSheetFragment : BottomSheetDialogFragment() {

    private var selectedSeans: String = ""
    private var selectedGun: String = ""
    private var kisiler: List<ListeKisi> = emptyList()

    companion object {
        fun newInstance(selectedGun: String, selectedSeans: String, kisiler: List<ListeKisi>): ListeSheetFragment {
            val f = ListeSheetFragment()
            f.selectedGun = selectedGun
            f.selectedSeans = selectedSeans
            f.kisiler = kisiler
            return f
        }
    }

    override fun getTheme(): Int = R.style.Theme_StardustScan_BottomSheetDialog

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_liste_sheet, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        view.findViewById<TextView>(R.id.listeTitle).text = "Seans $selectedSeans"
        view.findViewById<TextView>(R.id.listeGunText).text = selectedGun

        val girisYapan = kisiler.count { it.giris > 0 }
        view.findViewById<TextView>(R.id.listeOzetSayi).text = "$girisYapan / ${kisiler.size}"

        val container = view.findViewById<LinearLayout>(R.id.listeContainer)
        val emptyText = view.findViewById<TextView>(R.id.listeEmptyText)
        if (kisiler.isEmpty()) {
            emptyText.visibility = View.VISIBLE
        } else {
            for (k in kisiler) {
                val row = LayoutInflater.from(requireContext()).inflate(R.layout.item_liste_row, container, false)
                row.findViewById<TextView>(R.id.liNameText).text = k.musteriAd
                row.findViewById<TextView>(R.id.liDetailText).text = "${k.giris}/${k.toplam} kişi"
                val badge = row.findViewById<TextView>(R.id.liBadgeText)
                if (k.giris > 0) {
                    badge.text = "${k.giris}/${k.toplam} Girdi"
                    badge.setBackgroundResource(R.drawable.bg_badge_ok)
                    badge.setTextColor(resources.getColor(R.color.textPrimary, null))
                } else {
                    badge.text = "Giriş Yapmadı"
                    badge.setBackgroundResource(R.drawable.bg_badge_no)
                    badge.setTextColor(resources.getColor(R.color.textDim, null))
                }
                val zamanView = row.findViewById<TextView>(R.id.liZamanText)
                if (!k.girisZamani.isNullOrEmpty()) {
                    zamanView.text = k.girisZamani
                } else {
                    zamanView.visibility = View.GONE
                }
                container.addView(row)
            }
        }

        view.findViewById<Button>(R.id.listeKapatButton).setOnClickListener { dismiss() }
    }
}
