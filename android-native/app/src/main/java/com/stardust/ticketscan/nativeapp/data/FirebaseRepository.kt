package com.stardust.ticketscan.nativeapp.data

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * All Firebase Auth + Realtime Database access, and the scan business
 * logic ported 1:1 from src/app/scan/page.tsx, extended with a second
 * checkpoint ("Orman" gate).
 *
 * GENEL gate behavior is byte-for-byte identical to the original single-
 * gate logic and uses the exact same kullanildi/kullanildiSaat fields the
 * website also reads/writes — nothing changes there, and the website
 * stays fully compatible.
 *
 * ORMAN gate is purely additive: new ormanGiris/ormanGirisSaat fields
 * that the website never looks at. A ticket/code must already have
 * kullanildi == true (genel entry done) before it's eligible at the
 * Orman gate — enforced in every code path below.
 */
object FirebaseRepository {

    private val auth get() = FirebaseAuth.getInstance()
    private val db get() = FirebaseDatabase.getInstance().reference

    // ── Auth ─────────────────────────────────────────────────────────────

    suspend fun login(email: String, password: String): AppUser {
        val cred = auth.signInWithEmailAndPassword(email, password).await()
        val uid = cred.user?.uid ?: throw IllegalStateException("Giriş başarısız")
        val snap = db.child("users").child(uid).get().await()
        if (!snap.exists()) {
            auth.signOut()
            throw IllegalStateException("Kullanıcı kaydı bulunamadı")
        }
        val name = snap.child("name").getValue(String::class.java) ?: ""
        val role = snap.child("role").getValue(String::class.java) ?: ""
        if (role != "admin" && role != "okutma") {
            auth.signOut()
            throw IllegalStateException("Bu hesabın okutma izni yok")
        }
        return AppUser(uid = uid, email = cred.user?.email ?: "", name = name, role = role)
    }

    fun currentUser(): AppUser? {
        val u = auth.currentUser ?: return null
        return AppUser(uid = u.uid, email = u.email ?: "", name = "", role = "")
    }

    suspend fun resolveCurrentUser(): AppUser? {
        val u = auth.currentUser ?: return null
        val snap = db.child("users").child(u.uid).get().await()
        if (!snap.exists()) return null
        val name = snap.child("name").getValue(String::class.java) ?: ""
        val role = snap.child("role").getValue(String::class.java) ?: ""
        if (role != "admin" && role != "okutma") return null
        return AppUser(uid = u.uid, email = u.email ?: "", name = name, role = role)
    }

    fun logout() {
        auth.signOut()
    }

    // ── Live watchers (biletler / kurumsalPaketler) ─────────────────────

    fun watchBiletler(): Flow<Map<String, BiletDoc>> = callbackFlow {
        val ref = db.child("biletler")
        val listener = object : ValueEventListener {
            override fun onDataChange(snap: DataSnapshot) {
                trySend(parseBiletlerSnapshot(snap))
            }
            override fun onCancelled(error: com.google.firebase.database.DatabaseError) { /* ignore, matches web behavior */ }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    fun watchKurumsalPaketler(): Flow<Map<String, KurumsalPaket>> = callbackFlow {
        val ref = db.child("kurumsalPaketler")
        val listener = object : ValueEventListener {
            override fun onDataChange(snap: DataSnapshot) {
                trySend(parseKurumsalSnapshot(snap))
            }
            override fun onCancelled(error: com.google.firebase.database.DatabaseError) { /* ignore */ }
        }
        ref.addValueEventListener(listener)
        awaitClose { ref.removeEventListener(listener) }
    }

    private fun parseBiletlerSnapshot(snap: DataSnapshot): Map<String, BiletDoc> {
        val out = mutableMapOf<String, BiletDoc>()
        for (child in snap.children) {
            val key = child.key ?: continue
            out[key] = BiletDoc(
                tarih = child.child("tarih").getValue(String::class.java) ?: "",
                seans = child.child("seans").getValue(String::class.java) ?: "",
                tur = child.child("tur").getValue(String::class.java) ?: "",
                kullanildi = child.child("kullanildi").getValue(Boolean::class.java) ?: false,
                musteriAd = child.child("musteriAd").getValue(String::class.java),
                kullanildiSaat = child.child("kullanildiSaat").getValue(String::class.java),
                ormanGiris = child.child("ormanGiris").getValue(Boolean::class.java) ?: false,
                ormanGirisSaat = child.child("ormanGirisSaat").getValue(String::class.java)
            )
        }
        return out
    }

    private fun parseKurumsalSnapshot(snap: DataSnapshot): Map<String, KurumsalPaket> {
        val out = mutableMapOf<String, KurumsalPaket>()
        for (child in snap.children) {
            val key = child.key ?: continue
            val biletler = mutableMapOf<String, KurumsalBilet>()
            for (bChild in child.child("biletler").children) {
                val bKey = bChild.key ?: continue
                biletler[bKey] = KurumsalBilet(
                    kod = bChild.child("kod").getValue(String::class.java) ?: "",
                    kullanildi = bChild.child("kullanildi").getValue(Boolean::class.java) ?: false,
                    kullanimTarihi = bChild.child("kullanimTarihi").getValue(String::class.java),
                    kullanimSaat = bChild.child("kullanimSaat").getValue(String::class.java),
                    ormanGiris = bChild.child("ormanGiris").getValue(Boolean::class.java) ?: false,
                    ormanGirisSaat = bChild.child("ormanGirisSaat").getValue(String::class.java)
                )
            }
            out[key] = KurumsalPaket(
                firma = child.child("firma").getValue(String::class.java) ?: "",
                baslangic = child.child("baslangic").getValue(String::class.java) ?: "",
                bitis = child.child("bitis").getValue(String::class.java) ?: "",
                adet = child.child("adet").getValue(Long::class.java)?.toInt() ?: 0,
                kullanilan = child.child("kullanilan").getValue(Long::class.java)?.toInt() ?: 0,
                biletler = biletler
            )
        }
        return out
    }

    // ── Seans stats (always reflects GENEL gate attendance) ─────────────

    fun getSeansIstatistik(biletler: Map<String, BiletDoc>, gun: String, seans: String): SeansIstatistik {
        val gb = biletler.values.filter { it.tarih == gun && it.seans == seans }
        return SeansIstatistik(toplam = gb.size, giris = gb.count { it.kullanildi })
    }

    // ── Core scan logic (mirrors islemYap + helpers in scan/page.tsx) ──

    sealed class ScanResult {
        data class Result(val sheet: ResultSheetData) : ScanResult()
        data class PNRFound(val pnr: String, val bekleyenler: List<BiletItem>, val sheet: ResultSheetData) : ScanResult()
    }

    suspend fun islemYap(
        valRaw: String,
        kurumsalPaketler: Map<String, KurumsalPaket>,
        selectedGun: String,
        selectedSeans: String,
        gate: Gate
    ): ScanResult {
        val v = valRaw.trim().uppercase()

        kurumsalScanKontrol(v, kurumsalPaketler, gate)?.let { kSonuc ->
            return ScanResult.Result(kurumsalResultSheet(kSonuc, gate))
        }

        return if (v.startsWith("SD-")) {
            sorgulaBiletNo(v, selectedGun, selectedSeans, gate)
        } else {
            sorgulaPNR(v, selectedGun, selectedSeans, gate)
        }
    }

    private suspend fun kurumsalScanKontrol(
        kod: String,
        kurumsalPaketler: Map<String, KurumsalPaket>,
        gate: Gate
    ): KurumsalSonuc? {
        for ((pKey, p) in kurumsalPaketler) {
            for ((bKey, b) in p.biletler) {
                if (b.kod != kod) continue
                val today = SeansHelpers.todayStr()
                val todayD = dmyToMillis(today)
                val basD = dmyToMillis(p.baslangic)
                val bitD = dmyToMillis(p.bitis)
                if (todayD < basD) return KurumsalSonuc(false, p.firma, "Bilet henüz geçerli değil")
                if (todayD > bitD) return KurumsalSonuc(false, p.firma, "Bilet süresi dolmuş (${p.bitis})")

                if (gate == Gate.GENEL) {
                    if (b.kullanildi) return KurumsalSonuc(false, p.firma, "Bu bilet zaten kullanıldı")
                    val saat = SeansHelpers.nowSaat()
                    db.child("kurumsalPaketler/$pKey/biletler/$bKey")
                        .updateChildren(mapOf("kullanildi" to true, "kullanimTarihi" to today, "kullanimSaat" to saat))
                        .await()
                    val yeniKullanilan = p.kullanilan + 1
                    db.child("kurumsalPaketler/$pKey")
                        .updateChildren(mapOf("kullanilan" to yeniKullanilan))
                        .await()
                    return KurumsalSonuc(
                        ok = true, firma = p.firma, msg = p.firma,
                        kullanilan = yeniKullanilan, toplam = p.adet,
                        kalan = p.adet - yeniKullanilan, bitis = p.bitis
                    )
                } else {
                    if (!b.kullanildi) return KurumsalSonuc(false, p.firma, "Önce genel girişten geçmeli")
                    if (b.ormanGiris) return KurumsalSonuc(false, p.firma, "Bu bilet zaten orman girişi yapmış")
                    val saat = SeansHelpers.nowSaat()
                    db.child("kurumsalPaketler/$pKey/biletler/$bKey")
                        .updateChildren(mapOf("ormanGiris" to true, "ormanGirisSaat" to saat))
                        .await()
                    return KurumsalSonuc(
                        ok = true, firma = p.firma, msg = p.firma,
                        kullanilan = p.kullanilan, toplam = p.adet,
                        kalan = p.adet - p.kullanilan, bitis = p.bitis
                    )
                }
            }
        }
        return null
    }

    private fun kurumsalResultSheet(r: KurumsalSonuc, gate: Gate): ResultSheetData {
        return if (r.ok) {
            val title = if (gate == Gate.GENEL) "Giriş Onaylandı" else "Orman Girişi Onaylandı"
            ResultSheetData(
                icon = "✓", title = title, titleIsGreen = true,
                name = r.firma,
                info = "${r.kullanilan} / ${r.toplam} bilet kullanıldı\n${r.kalan} bilet kaldı · Geçerlilik: ${r.bitis}",
                showGiris = false
            )
        } else {
            ResultSheetData(
                icon = "✗", title = "Geçersiz Bilet", titleIsGreen = false,
                name = r.firma, info = r.msg, showGiris = false
            )
        }
    }

    private suspend fun sorgulaPNR(val_: String, selectedGun: String, selectedSeans: String, gate: Gate): ScanResult {
        val snap = db.child("pnrler").child(val_).get().await()
        if (!snap.exists()) {
            return ScanResult.Result(
                ResultSheetData("✗", "PNR Bulunamadı", false, "", "Bu PNR sistemde kayıtlı değil.", showGiris = false)
            )
        }
        val musteriAd = snap.child("musteriAd").getValue(String::class.java) ?: ""
        val tarih = snap.child("tarih").getValue(String::class.java) ?: ""
        val seans = snap.child("seans").getValue(String::class.java) ?: ""
        val tam = snap.child("tam").getValue(Long::class.java)?.toInt() ?: 0
        val cocuk = snap.child("cocuk").getValue(Long::class.java)?.toInt() ?: 0
        val yabanci = snap.child("yabanci").getValue(Long::class.java)?.toInt() ?: 0
        val biletNoList = mutableListOf<String>()
        snap.child("biletler").children.forEach { c -> c.getValue(String::class.java)?.let { biletNoList.add(it) } }

        val biletSnaplar = biletNoList.map { bno -> db.child("biletler").child(bno).get().await() }
        val biletDocs = biletSnaplar.map { bs ->
            if (!bs.exists()) null else BiletDoc(
                tarih = bs.child("tarih").getValue(String::class.java) ?: "",
                seans = bs.child("seans").getValue(String::class.java) ?: "",
                tur = bs.child("tur").getValue(String::class.java) ?: "",
                kullanildi = bs.child("kullanildi").getValue(Boolean::class.java) ?: false,
                musteriAd = bs.child("musteriAd").getValue(String::class.java),
                kullanildiSaat = bs.child("kullanildiSaat").getValue(String::class.java),
                ormanGiris = bs.child("ormanGiris").getValue(Boolean::class.java) ?: false,
                ormanGirisSaat = bs.child("ormanGirisSaat").getValue(String::class.java)
            )
        }
        val tumKurumsal = biletDocs.isNotEmpty() && biletDocs.all { it?.tur == "kurumsal" }

        if (!tumKurumsal && (tarih != selectedGun || seans != selectedSeans)) {
            return ScanResult.Result(
                ResultSheetData(
                    "⚠️", "Yanlış Seans", false, musteriAd,
                    "Bu bilet $tarih · Seans $seans için geçerlidir.\nŞu an: $selectedGun · Seans $selectedSeans",
                    showGiris = false
                )
            )
        }

        if (gate == Gate.GENEL) {
            val biletItems = biletNoList.mapIndexed { i, bno ->
                val d = biletDocs[i]
                BiletItem(no = bno, tur = d?.tur ?: "-", kullanildi = d?.kullanildi ?: false, checked = !(d?.kullanildi ?: false))
            }
            val bekleyenler = biletItems.filter { !it.kullanildi }
            if (bekleyenler.isEmpty()) {
                return ScanResult.Result(
                    ResultSheetData("✗", "Tümü Kullanılmış", false, musteriAd, "$tarih · Seans $seans", showGiris = false)
                )
            }

            if (tumKurumsal) {
                val saat = SeansHelpers.nowSaat()
                val upd = mutableMapOf<String, Any?>()
                bekleyenler.forEach { b ->
                    upd["biletler/${b.no}/kullanildi"] = true
                    upd["biletler/${b.no}/kullanildiSaat"] = saat
                }
                db.updateChildren(upd).await()
                return ScanResult.Result(
                    ResultSheetData("✓", "Kurumsal Giriş", true, musteriAd, "${bekleyenler.size} bilet onaylandı", showGiris = false)
                )
            }

            val sheet = ResultSheetData(
                "📋", "PNR Bulundu", false, musteriAd,
                "$tarih · Seans $seans\nTam: $tam · Çocuk: $cocuk · Yabancı: $yabanci",
                biletler = biletItems, showGiris = true
            )
            return ScanResult.PNRFound(pnr = val_, bekleyenler = bekleyenler, sheet = sheet)
        } else {
            // ORMAN gate: only tickets that already cleared GENEL are
            // eligible. Tickets with no genel entry yet show up in the
            // list (so staff can see why) but can't be selected.
            val biletItems = biletNoList.mapIndexed { i, bno ->
                val d = biletDocs[i]
                val genelYapildi = d?.kullanildi ?: false
                val ormanYapildi = d?.ormanGiris ?: false
                BiletItem(
                    no = bno, tur = d?.tur ?: "-",
                    kullanildi = ormanYapildi, // reuse "kullanildi" as "already done at THIS gate" for the checklist UI
                    checked = genelYapildi && !ormanYapildi,
                    genelYapildi = genelYapildi, ormanYapildi = ormanYapildi
                )
            }
            val hicGenelYok = biletItems.none { it.genelYapildi }
            if (hicGenelYok) {
                return ScanResult.Result(
                    ResultSheetData("⚠️", "Önce Genel Giriş Gerekli", false, musteriAd,
                        "Bu PNR için henüz genel giriş yapılmamış.", showGiris = false)
                )
            }
            val bekleyenler = biletItems.filter { it.genelYapildi && !it.ormanYapildi }
            if (bekleyenler.isEmpty()) {
                return ScanResult.Result(
                    ResultSheetData("✗", "Tümü Orman Girişi Yapmış", false, musteriAd, "$tarih · Seans $seans", showGiris = false)
                )
            }

            if (tumKurumsal) {
                val saat = SeansHelpers.nowSaat()
                val upd = mutableMapOf<String, Any?>()
                bekleyenler.forEach { b ->
                    upd["biletler/${b.no}/ormanGiris"] = true
                    upd["biletler/${b.no}/ormanGirisSaat"] = saat
                }
                db.updateChildren(upd).await()
                return ScanResult.Result(
                    ResultSheetData("✓", "Kurumsal Orman Girişi", true, musteriAd, "${bekleyenler.size} bilet onaylandı", showGiris = false)
                )
            }

            val sheet = ResultSheetData(
                "🌲", "PNR Bulundu", false, musteriAd,
                "$tarih · Seans $seans\nTam: $tam · Çocuk: $cocuk · Yabancı: $yabanci",
                biletler = biletItems, showGiris = true
            )
            return ScanResult.PNRFound(pnr = val_, bekleyenler = bekleyenler, sheet = sheet)
        }
    }

    private suspend fun sorgulaBiletNo(val_: String, selectedGun: String, selectedSeans: String, gate: Gate): ScanResult {
        val snap = db.child("biletler").child(val_).get().await()
        if (!snap.exists()) {
            return ScanResult.Result(ResultSheetData("✗", "Geçersiz Bilet", false, "", "Bu bilet bulunamadı.", showGiris = false))
        }
        val tarih = snap.child("tarih").getValue(String::class.java) ?: ""
        val seans = snap.child("seans").getValue(String::class.java) ?: ""
        val tur = snap.child("tur").getValue(String::class.java) ?: ""
        val kullanildi = snap.child("kullanildi").getValue(Boolean::class.java) ?: false
        val musteriAd = snap.child("musteriAd").getValue(String::class.java) ?: ""
        val kullanildiSaat = snap.child("kullanildiSaat").getValue(String::class.java) ?: ""
        val ormanGiris = snap.child("ormanGiris").getValue(Boolean::class.java) ?: false
        val ormanGirisSaat = snap.child("ormanGirisSaat").getValue(String::class.java) ?: ""

        if (gate == Gate.ORMAN) {
            if (!kullanildi) {
                return ScanResult.Result(
                    ResultSheetData("⚠️", "Önce Genel Giriş Gerekli", false, musteriAd, "Bu biletin genel girişi yapılmamış.", showGiris = false)
                )
            }
            if (ormanGiris) {
                return ScanResult.Result(
                    ResultSheetData("✗", "Kullanılmış", false, musteriAd, "$ormanGirisSaat saatinde orman girişi yapıldı.", showGiris = false)
                )
            }
            val saat = SeansHelpers.nowSaat()
            db.updateChildren(mapOf("biletler/$val_/ormanGiris" to true, "biletler/$val_/ormanGirisSaat" to saat)).await()
            val info = if (tur == "kurumsal") "Kurumsal bilet\n$val_" else "Seans: $seans · $tur\n$tarih"
            return ScanResult.Result(
                ResultSheetData("✓", "Orman Girişi Onaylandı", true, musteriAd.ifEmpty { "Misafir" }, info, showGiris = false)
            )
        }

        // GENEL gate — unchanged from the original single-gate behavior.
        if (tur == "kurumsal") {
            if (kullanildi) {
                return ScanResult.Result(
                    ResultSheetData("✗", "Kullanılmış", false, musteriAd, "$kullanildiSaat saatinde giriş yapıldı.", showGiris = false)
                )
            }
            val saat = SeansHelpers.nowSaat()
            db.updateChildren(mapOf("biletler/$val_/kullanildi" to true, "biletler/$val_/kullanildiSaat" to saat)).await()
            return ScanResult.Result(
                ResultSheetData(
                    "✓", "Kurumsal Giriş", true,
                    musteriAd.ifEmpty { "Kurumsal Misafir" }, "Kurumsal bilet\n$val_", showGiris = false
                )
            )
        }

        if (tarih != selectedGun || seans != selectedSeans) {
            return ScanResult.Result(
                ResultSheetData(
                    "⚠️", "Yanlış Seans", false, musteriAd,
                    "Bu bilet $tarih · Seans $seans için geçerlidir.\nŞu an: $selectedGun · Seans $selectedSeans",
                    showGiris = false
                )
            )
        }
        if (kullanildi) {
            return ScanResult.Result(
                ResultSheetData("✗", "Kullanılmış", false, musteriAd, "$kullanildiSaat saatinde giriş yapıldı.", showGiris = false)
            )
        }

        val biletSaat = SeansHelpers.nowSaat()
        db.updateChildren(mapOf("biletler/$val_/kullanildi" to true, "biletler/$val_/kullanildiSaat" to biletSaat)).await()
        return ScanResult.Result(
            ResultSheetData("✓", "Bilet Geçerli", true, musteriAd, "Seans: $seans · $tur\n$tarih", showGiris = false)
        )
    }

    suspend fun girisVer(pnr: String, secilenler: List<String>, gate: Gate) {
        val saat = SeansHelpers.nowSaat()
        val upd = mutableMapOf<String, Any?>()
        val flagField = if (gate == Gate.GENEL) "kullanildi" else "ormanGiris"
        val saatField = if (gate == Gate.GENEL) "kullanildiSaat" else "ormanGirisSaat"
        secilenler.forEach { bno ->
            upd["biletler/$bno/$flagField"] = true
            upd["biletler/$bno/$saatField"] = saat
        }
        db.updateChildren(upd).await()
    }

    /** Only meaningful for the GENEL gate — mirrors the website's own PNR-level completion flag. */
    suspend fun markPnrFullyUsed(pnr: String) {
        val saat = SeansHelpers.nowSaat()
        db.updateChildren(mapOf("pnrler/$pnr/kullanildi" to true, "pnrler/$pnr/kullanildiSaat" to saat)).await()
    }

    // ── Liste sheet (always reflects GENEL gate attendance) ─────────────

    suspend fun fetchListeKisiler(
        selectedGun: String,
        selectedSeans: String,
        biletler: Map<String, BiletDoc>
    ): List<ListeKisi> {
        val snap = db.child("pnrler").get().await()
        val out = mutableListOf<ListeKisi>()
        for (child in snap.children) {
            val tarih = child.child("tarih").getValue(String::class.java) ?: ""
            val seans = child.child("seans").getValue(String::class.java) ?: ""
            if (tarih != selectedGun || seans != selectedSeans) continue
            val musteriAd = child.child("musteriAd").getValue(String::class.java) ?: ""
            val tam = child.child("tam").getValue(Long::class.java)?.toInt() ?: 0
            val cocuk = child.child("cocuk").getValue(Long::class.java)?.toInt() ?: 0
            val yabanci = child.child("yabanci").getValue(Long::class.java)?.toInt() ?: 0
            val biletNoList = mutableListOf<String>()
            child.child("biletler").children.forEach { c -> c.getValue(String::class.java)?.let { biletNoList.add(it) } }

            val giris = biletNoList.count { biletler[it]?.kullanildi == true }
            val girisZamani = biletNoList.mapNotNull { biletler[it]?.kullanildiSaat }.firstOrNull()
            val toplam = if (biletNoList.isNotEmpty()) biletNoList.size else (tam + cocuk + yabanci)
            out.add(ListeKisi(musteriAd = musteriAd, giris = giris, toplam = toplam, girisZamani = girisZamani))
        }
        return out
    }

    private fun dmyToMillis(s: String): Long {
        val p = s.split(".")
        val cal = java.util.Calendar.getInstance()
        cal.set(p[2].toInt(), p[1].toInt() - 1, p[0].toInt(), 0, 0, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }
}
