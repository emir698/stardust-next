'use client';

import { useState, useMemo } from 'react';
import { useSatisList, useCodes, useBatches, useVitoDrivers, useKurumsalPaketler } from '@/hooks/useFirebaseData';
import { KpiCard } from '@/components/ui/KpiCard';
import { dateToInput, inputToDate, todayStr, addDays, dateInRange, fmtMoney } from '@/lib/utils';

const ALL_SAATLER = ['20:45', '21:00', '21:30', '22:00', '22:30'];

// ─── Donut ────────────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-mu text-sm text-center py-12">Veri yok</div>;

  const cx = 64, cy = 64, r = 50;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = data.map(d => {
    const pct = d.value / total;
    const arc = { pct, offset, color: d.color, label: d.label, value: d.value };
    offset += pct;
    return arc;
  });

  return (
    <div className="flex items-center gap-10">
      <div className="relative flex-shrink-0">
        <svg width="128" height="128" viewBox="0 0 128 128">
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={a.color}
              strokeWidth="16"
              strokeDasharray={`${a.pct * circ} ${circ}`}
              strokeDashoffset={`${-a.offset * circ}`}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-semibold tracking-tight text-tx">{total}</span>
          <span className="text-[11px] text-mu mt-0.5">kişi</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {arcs.filter(a => a.value > 0).map(a => (
          <div key={a.label} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
            <span className="text-[13px] text-tx flex-1 truncate">{a.label}</span>
            <span className="text-[13px] font-mono font-semibold text-tx tabular-nums">{a.value}</span>
            <span className="text-[11px] font-mono text-mu w-9 text-right tabular-nums">
              {Math.round(a.value / total * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#f87171' : pct >= 50 ? '#60a5fa' : '#34d399';
  return (
    <div className="h-2 bg-sf3 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const satisList        = useSatisList();
  const codes            = useCodes();
  const batches          = useBatches();
  const vitoDrivers      = useVitoDrivers();
  const kurumsalPaketler = useKurumsalPaketler();

  const today = todayStr();
  const [startDate, setStartDate] = useState(addDays(today, -6));
  const [endDate, setEndDate]     = useState(today);

  const filtered = useMemo(() =>
    satisList.filter(t => t?.tarih && dateInRange(t.tarih, startDate, endDate)),
    [satisList, startDate, endDate]
  );

  const donemBilet    = filtered.reduce((s, t) => s + (t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0), 0);
  const donemGelir    = filtered.reduce((s, t) => s + (t.toplam||0), 0);
  const kodAktif      = codes.filter(c => c?.status === 'aktif').length;
  const kodKullanilan = codes.length - kodAktif;
  const kodDonem      = codes.filter(c => c?.date && dateInRange(c.date, startDate, endDate)).length;

  const donutData = [
    { label: 'Tam',      value: filtered.reduce((s, t) => s + (t.tam||0), 0),      color: '#60a5fa' },
    { label: 'Çocuk',    value: filtered.reduce((s, t) => s + (t.cocuk||0), 0),    color: '#34d399' },
    { label: 'Yabancı',  value: filtered.reduce((s, t) => s + (t.yabanci||0), 0),  color: '#a78bfa' },
    { label: 'Davetli',  value: filtered.reduce((s, t) => s + (t.davetli||0), 0),  color: '#f472b6' },
    { label: 'Kurumsal', value: filtered.reduce((s, t) => s + (t.kurumsal||0), 0), color: '#fb923c' },
  ];

  const seansData = ALL_SAATLER.map(saat => {
    const st = filtered.filter(t => t.seans === saat);
    return {
      saat,
      bilet: st.reduce((s, t) => s + (t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0), 0),
      gelir: st.reduce((s, t) => s + (t.toplam||0), 0),
    };
  });

  const grupData = batches.map(b => {
    const tot = (b.codes || []).length;
    const kul = (b.codes || []).filter(c => codes.find(x => x?.code === c)?.status === 'deaktif').length;
    const donemKul = (b.codes || []).filter(c => {
      const cd = codes.find(x => x?.code === c);
      return cd?.status === 'deaktif' && cd.date && dateInRange(cd.date, startDate, endDate);
    }).length;
    return { name: b.name, toplam: tot, kullanilan: kul, aktif: tot - kul, donem: donemKul };
  }).sort((a, b) => (b.toplam > 0 ? b.kullanilan / b.toplam : 0) - (a.toplam > 0 ? a.kullanilan / a.toplam : 0));

  const vitoSatislar = satisList.filter(t => t.vitoSurucu && dateInRange(t.tarih, startDate, endDate));
  const vitoRapor = vitoDrivers.map(d => {
    const turler = vitoSatislar.filter(t => t.vitoSurucu === d._key);
    return {
      driver: d,
      turSayisi: turler.length,
      toplamKisi: turler.reduce((s, t) => s + (t.tam||0)+(t.cocuk||0)+(t.yabanci||0), 0),
      toplamHakedis: turler.reduce((s, t) => s + (t.vitoKomisyon||0), 0),
      turler,
    };
  }).filter(v => v.turSayisi > 0);

  const setHizli = (gun: number) => { setEndDate(today); setStartDate(addDays(today, -gun + 1)); };

  const totalPct = codes.length > 0 ? Math.round(kodKullanilan / codes.length * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ─── Tarih Filtre Kartı ─────────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl border border-bd2 p-6 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-mu uppercase tracking-widest mr-2">Dönem</span>
        {[{ l: 'Bugün', d: 1 }, { l: '7 Gün', d: 7 }, { l: '30 Gün', d: 30 }].map(({ l, d }) => (
          <button
            key={l}
            onClick={() => setHizli(d)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-mu border border-bd bg-sf2 hover:text-tx hover:border-bd2 transition-all"
          >
            {l}
          </button>
        ))}
        <div className="h-6 w-px bg-bd2 mx-2" />
        <input
          type="date"
          value={dateToInput(startDate)}
          onChange={e => setStartDate(inputToDate(e.target.value))}
          className="bg-sf border border-bd rounded-xl px-4 py-2.5 text-tx font-mono text-sm outline-none focus:border-ac/50 cursor-pointer"
        />
        <span className="text-mu text-base">—</span>
        <input
          type="date"
          value={dateToInput(endDate)}
          onChange={e => setEndDate(inputToDate(e.target.value))}
          className="bg-sf border border-bd rounded-xl px-4 py-2.5 text-tx font-mono text-sm outline-none focus:border-ac/50 cursor-pointer"
        />
      </div>

      {/* ─── KPI Kartları ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-6">
        <KpiCard label="Dönem Bilet" value={donemBilet.toLocaleString('tr-TR')} sub="kişi" color="ac" />
        <KpiCard label="Dönem Gelir" value={fmtMoney(donemGelir)} color="gn" />
        <KpiCard label="Aktif Kod" value={kodAktif.toLocaleString('tr-TR')} sub={`${kodKullanilan} kullanıldı`} color="bl" />
        <KpiCard label="Dönem Kullanım" value={kodDonem} sub="seçili aralıkta" color="rd" />
      </div>

      {/* ─── 2 Sütun: Grafik + Seans Tablosu ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bilet Dağılımı */}
        <div className="glass-card rounded-2xl border border-bd2 overflow-hidden">
          <div className="px-6 py-5 border-b border-bd2">
            <h2 className="text-xl font-semibold text-tx">Bilet Dağılımı</h2>
          </div>
          <div className="p-6">
            <DonutChart data={donutData} />
          </div>
        </div>

        {/* Seans Tablosu */}
        <div className="glass-card rounded-2xl border border-bd2 overflow-hidden">
          <div className="px-6 py-5 border-b border-bd2">
            <h2 className="text-xl font-semibold text-tx">Seans Dağılımı</h2>
          </div>
          <div>
            <div className="grid grid-cols-3 px-6 py-3 border-b border-bd">
              <span className="text-xs font-semibold text-mu uppercase tracking-widest">Seans</span>
              <span className="text-xs font-semibold text-mu uppercase tracking-widest text-center">Bilet</span>
              <span className="text-xs font-semibold text-mu uppercase tracking-widest text-right">Gelir</span>
            </div>
            {seansData.map((s, i) => (
              <div
                key={s.saat}
                className={`grid grid-cols-3 items-center px-6 py-5 ${i < seansData.length - 1 ? 'border-b border-bd' : ''}`}
              >
                <span className="font-mono text-base text-mu">{s.saat}</span>
                <span className="text-xl font-bold tabular-nums text-center">{s.bilet}</span>
                <span className="text-base font-mono text-gn tabular-nums text-right">{fmtMoney(s.gelir)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── İndirim Kodu Durumu ───────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl border border-bd2 overflow-hidden">
        <div className="px-6 py-5 border-b border-bd2 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-tx">İndirim Kodu Durumu</h2>
          <div className="flex items-center gap-4 text-sm font-mono text-mu tabular-nums">
            <span className="text-rd font-semibold">{kodKullanilan} kullanıldı</span>
            <span className="text-bd2">·</span>
            <span className="text-gn font-semibold">{kodAktif} kaldı</span>
          </div>
        </div>
        <div className="p-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-base font-semibold">Toplam Stok</span>
            <p className="text-sm text-mu tabular-nums font-mono">%{totalPct}</p>
          </div>
          <ProgressBar pct={totalPct} />

          {grupData.length > 0 && (
            <div className="space-y-3 mt-6">
              {grupData.map(g => {
                const pct = g.toplam > 0 ? Math.round(g.kullanilan / g.toplam * 100) : 0;
                return (
                  <div key={g.name} className="glass-card rounded-xl border border-bd px-6 py-5">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-semibold">{g.name}</span>
                        {pct >= 80 && (
                          <span className="text-xs text-rd font-semibold bg-rdd px-2.5 py-0.5 rounded-full">Stok azalıyor</span>
                        )}
                        {g.donem > 0 && (
                          <span className="text-xs text-bl font-mono">+{g.donem} bu dönem</span>
                        )}
                      </div>
                      <span className="text-sm font-mono text-mu tabular-nums">{g.kullanilan}/{g.toplam}</span>
                    </div>
                    <ProgressBar pct={pct} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Kurumsal Paketler ──────────────────────────────────────────────────── */}
      {kurumsalPaketler.length > 0 && (
        <div className="grid grid-cols-3 gap-6">
          {kurumsalPaketler.map(p => {
            const kullanilanAdet = p.kullanilanAdet ?? 0;
            const pct = p.adet > 0 ? Math.round(kullanilanAdet / p.adet * 100) : 0;
            return (
              <div key={p._key} className="glass-card rounded-2xl border border-bd2 overflow-hidden">
                <div className="px-6 py-5 border-b border-bd2">
                  <h2 className="text-lg font-semibold text-tx">{p.firma}</h2>
                  <p className="text-sm text-mu mt-1">{p.baslangic} — {p.bitis}</p>
                </div>
                <div className="p-6">
                  <p className="text-4xl font-bold tracking-tight text-ac tabular-nums mb-4">
                    {kullanilanAdet}
                    <span className="text-mu text-xl font-normal">/{p.adet ?? 0}</span>
                  </p>
                  <ProgressBar pct={pct} />
                  <p className="text-sm text-mu mt-2 tabular-nums text-right font-mono">%{pct}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Vito Komisyon ─────────────────────────────────────────────────────── */}
      {vitoRapor.length > 0 && (
        <div className="glass-card rounded-2xl border border-bd2 overflow-hidden">
          <div className="px-6 py-5 border-b border-bd2">
            <h2 className="text-xl font-semibold text-tx">Vito Komisyon</h2>
          </div>

          {/* Özet satırı */}
          <div className="grid grid-cols-3 border-b border-bd2">
            {[
              { label: 'Tur Sayısı', value: vitoRapor.reduce((s, v) => s + v.turSayisi, 0), color: '' },
              { label: 'Toplam Kişi', value: vitoRapor.reduce((s, v) => s + v.toplamKisi, 0), color: '' },
              { label: 'Toplam Hakediş', value: fmtMoney(vitoRapor.reduce((s, v) => s + v.toplamHakedis, 0)), color: 'text-bl' },
            ].map((k, i) => (
              <div key={k.label} className={`px-6 py-6 ${i < 2 ? 'border-r border-bd2' : ''}`}>
                <p className="text-xs font-semibold text-mu uppercase tracking-widest mb-2">{k.label}</p>
                <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Detay tablosu */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bd2">
                {['Sürücü', 'Tarih', 'Seans', 'Kişi', 'Hakediş', 'Ödeme'].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-mu uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vitoRapor.flatMap(v =>
                v.turler.map(t => (
                  <tr key={t.id} className="border-b border-bd last:border-0 hover:bg-sf2/60 transition-colors">
                    <td className="px-6 py-4 text-base font-semibold">{v.driver.ad}</td>
                    <td className="px-6 py-4 font-mono text-mu">{t.tarih}</td>
                    <td className="px-6 py-4 font-mono">{t.seans}</td>
                    <td className="px-6 py-4 font-mono tabular-nums text-base">{(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)}</td>
                    <td className="px-6 py-4 text-bl font-mono tabular-nums font-bold text-base">{fmtMoney(t.vitoKomisyon||0)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${t.vitoOdendi ? 'bg-gd text-gn' : 'bg-rdd text-rd'}`}>
                        {t.vitoOdendi ? 'Ödendi' : 'Bekliyor'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
