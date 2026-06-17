'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSatisList, useCodes, useBatches, useVitoDrivers } from '@/hooks/useFirebaseData';
import { dateToInput, inputToDate, todayStr, dateInRange, fmtMoney } from '@/lib/utils';
import { HAFTALIK_SAATLER } from '@/types';

function getAllAktifSaatler(): string[] {
  const set = new Set<string>();
  Object.values(HAFTALIK_SAATLER).forEach(saatler => saatler.forEach(s => set.add(s)));
  return Array.from(set).sort();
}
const ALL_SAATLER = getAllAktifSaatler();

/* ── Animasyonlu Donut (v0.dev stili) ───────────────────── */
function AnimatedDonut({ data, total }: {
  data: { label: string; value: number; pct: number; offset: number }[];
  total: number;
}) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const DURATION = 900;

  useEffect(() => {
    setProgress(0);
    startRef.current = 0;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / DURATION, 1);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(eased);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [total]);

  const SIZE = 200;
  const R = 62;
  const cx = SIZE / 2, cy = SIZE / 2;
  const circ = 2 * Math.PI * R;

  if (total === 0) return (
    <div style={{ color: 'var(--color-mu)', fontSize: 13, textAlign: 'center', padding: '3rem 0' }}>Veri yok</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--color-bd)" strokeWidth={20} />
          {/* Segments */}
          {data.filter(d => d.value > 0).map((d, i) => {
            const segLen = d.pct * circ * progress;
            const gap = circ - segLen;
            const dashOffset = -(d.offset * circ * progress);
            return (
              <circle key={i} cx={cx} cy={cy} r={R} fill="none"
                stroke={d.pct > 0 ? `hsl(0,0%,${Math.round(85 - i * 18)}%)` : 'transparent'}
                strokeWidth={20}
                strokeDasharray={`${segLen} ${gap}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                style={{ transition: 'none' }}
              />
            );
          })}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)', color: 'var(--color-tx)' }}>
            {Math.round(total * progress)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-mu)', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            kişi
          </span>
        </div>
      </div>
      {/* Legend */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.filter(d => d.value > 0).map((d, i) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: `hsl(0,0%,${Math.round(85 - i * 18)}%)`,
            }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--color-mu)' }}>{d.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-tx)' }}>{d.value}</span>
            <span style={{ fontSize: 12, color: 'var(--color-mu)', fontFamily: 'var(--font-mono)', minWidth: 32, textAlign: 'right' }}>
              {Math.round(d.pct * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI Kartı ───────────────────────────────────────────── */
function KpiCard({ label, value, sub, trend }: {
  label: string; value: string; sub?: string; trend?: { text: string; up: boolean };
}) {
  return (
    <div style={{
      background: 'var(--color-sf)',
      border: '1px solid var(--color-bd)',
      borderRadius: 8,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-mu)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--color-tx)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
        {value}
      </div>
      {trend && (
        <div style={{ fontSize: 12, color: trend.up ? 'var(--color-tx)' : 'var(--color-mu)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{trend.up ? '↗' : '↘'}</span>
          <span>{trend.text}</span>
        </div>
      )}
      {sub && !trend && (
        <div style={{ fontSize: 12, color: 'var(--color-mu)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

/* ── Kapasite Barı ───────────────────────────────────────── */
function CapacityBar({ label: _label, filled, total, sub }: {
  label: string; filled: number; total: number; sub?: string;
}) {
  const pct = total > 0 ? (filled / total) * 100 : 0;
  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid var(--color-bd)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-tx)' }}>{_label}</span>
        <div style={{ textAlign: 'right' }}>
          {sub && <div style={{ fontSize: 11, color: 'var(--color-mu)', marginBottom: 2 }}>{sub}</div>}
          <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-mu)' }}>
            {filled} / {total}
          </span>
        </div>
      </div>
      <div style={{ height: 3, background: 'var(--color-bd)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', background: 'var(--color-tx)', borderRadius: 99,
          width: `${pct}%`, transition: 'width 0.7s cubic-bezier(0.25,0.46,0.45,0.94)',
        }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-mu)', marginTop: 4 }}>{Math.round(pct)}% dolu</div>
    </div>
  );
}

export default function DashboardPage() {
  const satisList = useSatisList();
  const codes = useCodes();
  const batches = useBatches();
  const vitoDrivers = useVitoDrivers();

  const today = todayStr();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const filtered = useMemo(
    () => satisList.filter(t => t?.tarih && dateInRange(t.tarih, startDate, endDate)),
    [satisList, startDate, endDate]
  );

  const donemBilet = filtered.reduce((s, t) => s + (t.tam||0) + (t.cocuk||0) + (t.yabanci||0) + (t.davetli||0) + (t.kurumsal||0), 0);
  const donemGelir = filtered.reduce((s, t) => s + (t.toplam||0), 0);
  const kodAktif = codes.filter(c => c?.status === 'aktif').length;
  const kodKullanilan = codes.length - kodAktif;
  const kodDonem = codes.filter(c => c?.date && dateInRange(c.date, startDate, endDate)).length;
  const ort = filtered.length > 0 ? donemGelir / filtered.length : 0;

  const donutRaw = [
    { label: 'Tam',      value: filtered.reduce((s,t) => s+(t.tam||0), 0) },
    { label: 'Çocuk',    value: filtered.reduce((s,t) => s+(t.cocuk||0), 0) },
    { label: 'Yabancı',  value: filtered.reduce((s,t) => s+(t.yabanci||0), 0) },
    { label: 'Davetli',  value: filtered.reduce((s,t) => s+(t.davetli||0), 0) },
    { label: 'Kurumsal', value: filtered.reduce((s,t) => s+(t.kurumsal||0), 0) },
  ];
  const donutTotal = donutRaw.reduce((s,d) => s+d.value, 0);
  let accOffset = 0;
  const donutData = donutRaw.map(d => {
    const pct = donutTotal > 0 ? d.value / donutTotal : 0;
    const item = { ...d, pct, offset: accOffset };
    accOffset += pct;
    return item;
  });

  const seansData = ALL_SAATLER.map(saat => {
    const st = filtered.filter(t => t.seans === saat);
    return {
      saat,
      bilet: st.reduce((s,t) => s+(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0), 0),
      gelir: st.reduce((s,t) => s+(t.toplam||0), 0),
    };
  });

  const grupData = batches.map(b => {
    const tot = (b.codes||[]).length;
    const kul = (b.codes||[]).filter(c => codes.find(x => x?.code === c)?.status === 'deaktif').length;
    return { name: b.name, toplam: tot, kullanilan: kul, aktif: tot - kul };
  }).sort((a, b) => (b.toplam > 0 ? b.kullanilan/b.toplam : 0) - (a.toplam > 0 ? a.kullanilan/a.toplam : 0));

  const vitoSatislar = satisList.filter(t => t.vitoSurucu && dateInRange(t.tarih, startDate, endDate));
  const vitoRapor = vitoDrivers.map(d => {
    const turler = vitoSatislar.filter(t => t.vitoSurucu === d._key);
    return {
      driver: d,
      turSayisi: turler.length,
      toplamKisi: turler.reduce((s,t) => s+(t.tam||0)+(t.cocuk||0)+(t.yabanci||0), 0),
      toplamHakedis: turler.reduce((s,t) => s+(t.vitoKomisyon||0), 0),
      turler,
    };
  }).filter(v => v.turSayisi > 0);

  const setBugun = () => { setStartDate(today); setEndDate(today); };

  return (
    <div style={{ maxWidth: 1200 }}>

      {/* Başlık + Tarih Filtre */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-tx)', letterSpacing: '-0.02em', margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--color-mu)', marginTop: 4 }}>Gerçek zamanlı bilet ofisi performansı</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={setBugun} style={{
            padding: '5px 12px', fontSize: 12, fontWeight: 500,
            background: 'var(--color-sf)', border: '1px solid var(--color-bd)',
            borderRadius: 6, color: 'var(--color-mu)', cursor: 'pointer',
            transition: 'all .1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-tx)'; e.currentTarget.style.borderColor = 'var(--color-bd2)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-mu)'; e.currentTarget.style.borderColor = 'var(--color-bd)'; }}
          >Bugün</button>
          <input type="date" value={dateToInput(startDate)} onChange={e => setStartDate(inputToDate(e.target.value))} style={{
            padding: '5px 10px', fontSize: 12, background: 'var(--color-sf)',
            border: '1px solid var(--color-bd)', borderRadius: 6, color: 'var(--color-tx)',
            outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)',
          }} />
          <span style={{ color: 'var(--color-mu)', fontSize: 12 }}>—</span>
          <input type="date" value={dateToInput(endDate)} onChange={e => setEndDate(inputToDate(e.target.value))} style={{
            padding: '5px 10px', fontSize: 12, background: 'var(--color-sf)',
            border: '1px solid var(--color-bd)', borderRadius: 6, color: 'var(--color-tx)',
            outline: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)',
          }} />
        </div>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, border: '1px solid var(--color-bd)', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
        <KpiCard label="Dönem Bilet" value={donemBilet.toLocaleString('tr-TR')} sub="kişi" />
        <KpiCard label="Dönem Gelir" value={fmtMoney(donemGelir)} />
        <KpiCard label="Ortalama Sipariş" value={fmtMoney(ort)} />
        <KpiCard label="İndirim Kodu" value={kodAktif.toString()} sub={`${kodKullanilan} kullanıldı`} />
      </div>

      {/* Orta Grid: Donut + Seans Kapasitesi */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Bilet Türü Dağılımı */}
        <div style={{ background: 'var(--color-sf)', border: '1px solid var(--color-bd)', borderRadius: 8, padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-tx)' }}>Bilet Türü Dağılımı</div>
            <div style={{ fontSize: 12, color: 'var(--color-mu)', marginTop: 2 }}>Seçili döneme göre dağılım</div>
          </div>
          <AnimatedDonut data={donutData} total={donutTotal} />
        </div>

        {/* Seans Kapasitesi */}
        <div style={{ background: 'var(--color-sf)', border: '1px solid var(--color-bd)', borderRadius: 8, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-tx)' }}>Seans Bazlı Satış</div>
            <div style={{ fontSize: 11, color: 'var(--color-mu)' }}>Satılan / Kapasite</div>
          </div>
          <div>
            {seansData.map((s, i) => (
              <div key={s.saat} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < seansData.length - 1 ? '1px solid var(--color-bd)' : 'none',
              }}>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-mu)' }}>{s.saat}</span>
                <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-tx)' }}>{s.bilet}</span>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--color-mu)' }}>{fmtMoney(s.gelir)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* İndirim Kodu Durumu */}
      <div style={{ background: 'var(--color-sf)', border: '1px solid var(--color-bd)', borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-tx)' }}>İndirim Kodu Durumu</div>
          <span style={{ fontSize: 12, color: 'var(--color-mu)', fontFamily: 'var(--font-mono)' }}>
            {kodKullanilan} kullanıldı · {kodAktif} kaldı
          </span>
        </div>
        <CapacityBar label="Toplam Stok" filled={kodKullanilan} total={codes.length} />
        {grupData.map(g => (
          <CapacityBar key={g.name} label={g.name} filled={g.kullanilan} total={g.toplam} />
        ))}
      </div>

      {/* Vito Komisyon */}
      {vitoRapor.length > 0 && (
        <div style={{ background: 'var(--color-sf)', border: '1px solid var(--color-bd)', borderRadius: 8, padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-tx)', marginBottom: 20 }}>Vito Komisyon Raporu</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, border: '1px solid var(--color-bd)', borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
            {[
              { label: 'Toplam Tur', value: vitoRapor.reduce((s,v) => s+v.turSayisi, 0).toString() },
              { label: 'Toplam Kişi', value: vitoRapor.reduce((s,v) => s+v.toplamKisi, 0).toString() },
              { label: 'Toplam Hakediş', value: fmtMoney(vitoRapor.reduce((s,v) => s+v.toplamHakedis, 0)) },
            ].map(item => (
              <div key={item.label} style={{ padding: '16px 20px', background: 'var(--color-sf2)' }}>
                <div style={{ fontSize: 11, color: 'var(--color-mu)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{item.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-tx)' }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr><th>Sürücü</th><th>Tarih</th><th>Seans</th><th>Kişi</th><th>Hakediş</th><th>Ödeme</th></tr>
              </thead>
              <tbody>
                {vitoRapor.flatMap(v => v.turler.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{v.driver.ad}</td>
                    <td className="dc">{t.tarih}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{t.seans}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtMoney(t.vitoKomisyon||0)}</td>
                    <td><span className={`badge ${t.vitoOdendi ? 'ba' : 'bdd'}`}>{t.vitoOdendi ? 'Ödendi' : 'Bekliyor'}</span></td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
