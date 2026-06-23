package com.stardust.ticketscan.nativeapp.data

/** Mirrors the web app's AppUser (src/types.ts) */
data class AppUser(
    val uid: String,
    val email: String,
    val name: String,
    val role: String
)

/** Mirrors PNRDoc from scan/page.tsx */
data class PNRDoc(
    val musteriAd: String = "",
    val tarih: String = "",
    val seans: String = "",
    val tam: Int = 0,
    val cocuk: Int = 0,
    val yabanci: Int = 0,
    val davetli: Int = 0,
    val biletler: List<String> = emptyList(),
    val kullanildi: Boolean = false,
    val kullanildiSaat: String? = null
)

/** Mirrors BiletDoc from scan/page.tsx (extends the base Bilet type) */
data class BiletDoc(
    val tarih: String = "",
    val seans: String = "",
    val tur: String = "",
    val kullanildi: Boolean = false,
    val musteriAd: String? = null,
    val kullanildiSaat: String? = null
)

/** Mirrors KurumsalBilet from scan/page.tsx */
data class KurumsalBilet(
    val kod: String = "",
    val kullanildi: Boolean = false,
    val kullanimTarihi: String? = null,
    val kullanimSaat: String? = null
)

/** Mirrors KurumsalPaketRaw from scan/page.tsx */
data class KurumsalPaket(
    val firma: String = "",
    val baslangic: String = "",
    val bitis: String = "",
    val adet: Int = 0,
    val kullanilan: Int = 0,
    val biletler: Map<String, KurumsalBilet> = emptyMap()
)

/** Result of a kurumsal (corporate) code scan */
data class KurumsalSonuc(
    val ok: Boolean,
    val firma: String,
    val msg: String,
    val kullanilan: Int = 0,
    val toplam: Int = 0,
    val kalan: Int = 0,
    val bitis: String = ""
)

/** Mirrors SeansIstatistik from scan/page.tsx */
data class SeansIstatistik(val toplam: Int, val giris: Int)

/** Mirrors BiletItem from scan/page.tsx (a single ticket line in the result sheet) */
data class BiletItem(
    val no: String,
    val tur: String,
    val kullanildi: Boolean,
    var checked: Boolean
)

/** Mirrors ResultSheet from scan/page.tsx */
data class ResultSheetData(
    val icon: String,
    val title: String,
    val titleIsGreen: Boolean,
    val name: String,
    val info: String,
    val biletler: List<BiletItem>? = null,
    val showGiris: Boolean
)

/** Mirrors ListeKisi from scan/page.tsx */
data class ListeKisi(
    val musteriAd: String,
    val giris: Int,
    val toplam: Int,
    val girisZamani: String?
)
