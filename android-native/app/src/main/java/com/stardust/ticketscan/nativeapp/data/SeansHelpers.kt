package com.stardust.ticketscan.nativeapp.data

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Ported directly from scan/page.tsx's "Seans helpers" section. Keep these
 * two tables in sync with the website if it ever changes — they're not
 * read from Firebase, they're hardcoded on both sides.
 */
object SeansHelpers {

    private val OZEL: Map<String, List<String>> = mapOf(
        "19.05.2026" to listOf("20:45", "21:00", "21:30", "22:00"),
        "28.05.2026" to listOf("20:45", "21:00", "21:30", "22:00", "22:30")
    )

    // Calendar.DAY_OF_WEEK: SUNDAY=1, MONDAY=2, ... SATURDAY=7
    // The web version uses JS's getDay() (SUNDAY=0 ... SATURDAY=6); the map
    // below is re-keyed to Calendar's convention so the same logic holds.
    private val HSEANS: Map<Int, List<String>> = mapOf(
        Calendar.WEDNESDAY to listOf("21:00", "21:30", "22:00", "22:30"),
        Calendar.FRIDAY to listOf("21:00", "21:30", "22:00", "22:30", "23:00"),
        Calendar.SATURDAY to listOf("21:00", "21:30", "22:00", "22:30", "23:00"),
        Calendar.SUNDAY to listOf("21:00", "21:30", "22:00", "22:30")
    )

    private val dayNames = listOf("Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi")
    private val monthNames = listOf(
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    )

    private fun pad(n: Int) = n.toString().padStart(2, '0')

    private fun calendarFor(ds: String): Calendar {
        val p = ds.split(".")
        val cal = Calendar.getInstance()
        cal.set(p[2].toInt(), p[1].toInt() - 1, p[0].toInt(), 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal
    }

    fun todayStr(): String {
        val n = Calendar.getInstance()
        return "${pad(n.get(Calendar.DAY_OF_MONTH))}.${pad(n.get(Calendar.MONTH) + 1)}.${n.get(Calendar.YEAR)}"
    }

    fun addDays(ds: String, n: Int): String {
        val cal = calendarFor(ds)
        cal.add(Calendar.DAY_OF_MONTH, n)
        return "${pad(cal.get(Calendar.DAY_OF_MONTH))}.${pad(cal.get(Calendar.MONTH) + 1)}.${cal.get(Calendar.YEAR)}"
    }

    fun getDayName(ds: String): String {
        val cal = calendarFor(ds)
        // Calendar.DAY_OF_WEEK: SUNDAY=1..SATURDAY=7 -> index 0..6 matching dayNames (Pazar..Cumartesi)
        return dayNames[cal.get(Calendar.DAY_OF_WEEK) - 1]
    }

    fun fmtDate(ds: String): String {
        val p = ds.split(".")
        return "${p[0].toInt()} ${monthNames[p[1].toInt() - 1]} ${p[2]}, ${getDayName(ds)}"
    }

    fun getSaatler(ds: String): List<String>? {
        OZEL[ds]?.let { return it }
        val cal = calendarFor(ds)
        return HSEANS[cal.get(Calendar.DAY_OF_WEEK)]
    }

    fun isEtkinlik(ds: String): Boolean = getSaatler(ds) != null

    fun nowSaat(): String {
        val fmt = SimpleDateFormat("HH:mm:ss", Locale.US)
        return fmt.format(Date())
    }

    /** Resolves the first valid event day starting today, looking up to 14 days ahead — mirrors the useEffect in scan/page.tsx */
    fun resolveInitialGun(): String {
        var gun = todayStr()
        if (!isEtkinlik(gun)) {
            for (i in 1..14) {
                val d = addDays(gun, i)
                if (isEtkinlik(d)) { gun = d; break }
            }
        }
        return gun
    }
}
