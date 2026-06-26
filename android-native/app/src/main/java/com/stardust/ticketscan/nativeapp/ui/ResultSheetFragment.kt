package com.stardust.ticketscan.nativeapp.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.stardust.ticketscan.nativeapp.R
import com.stardust.ticketscan.nativeapp.data.BiletItem
import com.stardust.ticketscan.nativeapp.data.ResultSheetData

/**
 * Mirrors the "Result Sheet" in scan/page.tsx: shows the outcome icon/
 * title/info, and — for a PNR-with-pending-tickets result — a checklist
 * of tickets plus a "Giriş Ver" button.
 */
class ResultSheetFragment : BottomSheetDialogFragment() {

    interface Listener {
        fun onGirisVer(secilenler: List<String>)
        fun onSheetDismissed()
    }

    var listener: Listener? = null
    private var data: ResultSheetData? = null
    // Mutable working copy so checkbox toggles don't require re-creating the fragment.
    private var bekleyenler: MutableList<BiletItem> = mutableListOf()

    companion object {
        fun newInstance(data: ResultSheetData): ResultSheetFragment {
            val f = ResultSheetFragment()
            f.data = data
            f.bekleyenler = data.biletler?.toMutableList() ?: mutableListOf()
            return f
        }
    }

    override fun getTheme(): Int = com.stardust.ticketscan.nativeapp.R.style.Theme_StardustScan_BottomSheetDialog

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        return inflater.inflate(R.layout.fragment_result_sheet, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val d = data ?: return

        view.findViewById<TextView>(R.id.resultIcon).text = d.icon
        val titleView = view.findViewById<TextView>(R.id.resultTitle)
        titleView.text = d.title
        titleView.setTextColor(
            resources.getColor(if (d.titleIsGreen) R.color.textPrimary else R.color.textMuted, null)
        )

        val nameView = view.findViewById<TextView>(R.id.resultName)
        if (d.name.isNotEmpty()) {
            nameView.visibility = View.VISIBLE
            nameView.text = d.name
        }
        view.findViewById<TextView>(R.id.resultInfo).text = d.info

        val biletContainer = view.findViewById<LinearLayout>(R.id.biletListContainer)
        biletContainer.removeAllViews()
        for (item in (d.biletler ?: emptyList())) {
            // Use the live working copy (bekleyenler) for checked state, but
            // render every ticket from d.biletler (includes already-used ones).
            val working = bekleyenler.find { it.no == item.no }
            addBiletRow(biletContainer, item, working)
        }

        val girisButton = view.findViewById<Button>(R.id.girisButton)
        if (d.showGiris) {
            girisButton.visibility = View.VISIBLE
            girisButton.setOnClickListener {
                val secili = bekleyenler.filter { it.checked }.map { it.no }
                if (secili.isEmpty()) return@setOnClickListener
                listener?.onGirisVer(secili)
            }
        }

        view.findViewById<Button>(R.id.kapatButton).setOnClickListener { dismiss() }
    }

    private fun addBiletRow(container: LinearLayout, item: BiletItem, working: BiletItem?) {
        val row = LayoutInflater.from(requireContext()).inflate(R.layout.item_bilet_row, container, false)
        row.findViewById<TextView>(R.id.biletNoText).text = item.no
        row.findViewById<TextView>(R.id.biletTurText).text = item.tur
        val checkbox = row.findViewById<CheckBox>(R.id.biletCheckbox)
        val statusText = row.findViewById<TextView>(R.id.biletStatusText)

        if (item.kullanildi) {
            checkbox.visibility = View.GONE
            statusText.text = "Kullanıldı"
            statusText.setBackgroundResource(R.drawable.bg_badge_no)
            statusText.setTextColor(resources.getColor(R.color.textDim, null))
        } else if (!item.genelYapildi) {
            // Orman gate only: this ticket hasn't cleared the genel
            // checkpoint yet, so it can't be given orman entry here.
            checkbox.visibility = View.GONE
            statusText.text = "Genel Girişi Yok"
            statusText.setBackgroundResource(R.drawable.bg_badge_no)
            statusText.setTextColor(resources.getColor(R.color.textDim, null))
        } else {
            checkbox.visibility = View.VISIBLE
            checkbox.isChecked = working?.checked ?: true
            statusText.text = "Bekliyor"
            statusText.setBackgroundResource(R.drawable.bg_badge_ok)
            statusText.setTextColor(resources.getColor(R.color.textPrimary, null))
            checkbox.setOnCheckedChangeListener { _, isChecked ->
                working?.checked = isChecked
            }
        }
        container.addView(row)
    }

    override fun onDismiss(dialog: android.content.DialogInterface) {
        super.onDismiss(dialog)
        listener?.onSheetDismissed()
    }
}
