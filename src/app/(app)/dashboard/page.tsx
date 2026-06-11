'use client';

import { useState, useMemo } from 'react';
import { useSatisList, useCodes, useBatches, useVitoDrivers, useKurumsalPaketler } from '@/hooks/useFirebaseData';
import { dateToInput, inputToDate, todayStr, addDays, dateInRange, fmtMoney } from '@/lib/utils';

const ALL_SAATLER = ['20:45', '21:00', '21:30', '22:00', '22:30'];

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ color:'var(--mu)', fontSize:13, textAlign:'center', padding:'3rem 0' }}>Veri yok</div>;
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
    <div className="donut-wrap">
      <div style={{ position:'relative', flexShrink:0 }}>
        <svg width="128" height="128" viewBox="0 0 128 128">
          {arcs.map((a, i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth="16"
              strokeDasharray={`${a.pct * circ} ${circ}`} strokeDashoffset={`${-a.offset * circ}`}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="round" />
          ))}
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <span style={{ fontSize:28, fontWeight:600, color:'var(--tx)' }}>{total}</span>
          <span style={{ fontSize:11, color:'var(--mu)' }}>kişi</span>
        </div>
      </div>
      <div className="donut-legend">
        {arcs.filter(a => a.value > 0).map(a => (
          <div key={a.label} className="donut-item">
            <span className="donut-dot" style={{ background: a.color }} />
            <span style={{ flex:1 }}>{a.label}</span>
            <span style={{ fontFamily:'var(--mo)', fontWeight:600 }}>{a.value}</span>
            <span className="donut-pct">{Math.round(a.value / total * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const donemBilet    = filtered.reduce((s, t) => s+(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0), 0);
  const donemGelir    = filtered.reduce((s, t) => s+(t.toplam||0), 0);
  const kodAktif      = codes.filter(c => c?.status === 'aktif').length;
  const kodKullanilan = codes.length - kodAktif;
  const kodDonem      = codes.filter(c => c?.date && dateInRange(c.date, startDate, endDate)).length;

  const donutData = [
    { label:'Tam',      value: filtered.reduce((s,t) => s+(t.tam||0), 0),      color:'#60a5fa' },
    { label:'Çocuk',    value: filtered.reduce((s,t) => s+(t.cocuk||0), 0),    color:'#34d399' },
    { label:'Yabancı',  value: filtered.reduce((s,t) => s+(t.yabanci||0), 0),  color:'#a78bfa' },
    { label:'Davetli',  value: filtered.reduce((s,t) => s+(t.davetli||0), 0),  color:'#f472b6' },
    { label:'Kurumsal', value: filtered.reduce((s,t) => s+(t.kurumsal||0), 0), color:'#fb923c' },
  ];

  const seansData = ALL_SAATLER.map(saat => {
    const st = filtered.filter(t => t.seans === saat);
    return { saat, bilet: st.reduce((s,t) => s+(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)+(t.davetli||0)+(t.kurumsal||0), 0), gelir: st.reduce((s,t) => s+(t.toplam||0), 0) };
  });

  const grupData = batches.map(b => {
    const tot = (b.codes||[]).length;
    const kul = (b.codes||[]).filter(c => codes.find(x => x?.code === c)?.status === 'deaktif').length;
    const donemKul = (b.codes||[]).filter(c => {
      const cd = codes.find(x => x?.code === c);
      return cd?.status === 'deaktif' && cd.date && dateInRange(cd.date, startDate, endDate);
    }).length;
    return { name: b.name, toplam: tot, kullanilan: kul, aktif: tot - kul, donem: donemKul };
  }).sort((a, b) => (b.toplam > 0 ? b.kullanilan/b.toplam : 0) - (a.toplam > 0 ? a.kullanilan/a.toplam : 0));

  const vitoSatislar = satisList.filter(t => t.vitoSurucu && dateInRange(t.tarih, startDate, endDate));
  const vitoRapor = vitoDrivers.map(d => {
    const turler = vitoSatislar.filter(t => t.vitoSurucu === d._key);
    return { driver: d, turSayisi: turler.length, toplamKisi: turler.reduce((s,t) => s+(t.tam||0)+(t.cocuk||0)+(t.yabanci||0), 0), toplamHakedis: turler.reduce((s,t) => s+(t.vitoKomisyon||0), 0), turler };
  }).filter(v => v.turSayisi > 0);

  const setHizli = (gun: number) => { setEndDate(today); setStartDate(addDays(today, -gun + 1)); };
  const totalPct = codes.length > 0 ? Math.round(kodKullanilan / codes.length * 100) : 0;

  return (
    <div>
      {/* Tarih Filtre */}
      <div className="date-filter" style={{ marginBottom:'1rem', padding:'.6rem 1rem' }}>
        <label style={{ fontSize:12 }}>Tarih Aralığı:</label>
        {[{l:'Bugün',d:1},{l:'7 Gün',d:7},{l:'30 Gün',d:30}].map(({l,d}) => (
          <button key={l} className="tarih-picker-buton pasif" style={{ padding:'5px 14px', fontSize:12 }} onClick={() => setHizli(d)}>{l}</button>
        ))}
        <input type="date" className="date-input" value={dateToInput(startDate)} onChange={e => setStartDate(inputToDate(e.target.value))} style={{ padding:'5px 8px', fontSize:12 }} />
        <span style={{ color:'var(--mu)' }}>—</span>
        <input type="date" className="date-input" value={dateToInput(endDate)} onChange={e => setEndDate(inputToDate(e.target.value))} style={{ padding:'5px 8px', fontSize:12 }} />
      </div>

      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:'1.5rem' }}>
        <div className="kpi"><div className="kpi-label">Dönem Bilet</div><div className="kpi-val ac">{donemBilet.toLocaleString('tr-TR')}</div><div className="kpi-sub">kişi</div></div>
        <div className="kpi"><div className="kpi-label">Dönem Gelir</div><div className="kpi-val gn">{fmtMoney(donemGelir)}</div></div>
        <div className="kpi"><div className="kpi-label">Aktif Kod</div><div className="kpi-val bl">{kodAktif.toLocaleString('tr-TR')}</div><div className="kpi-sub">{kodKullanilan} kullanıldı</div></div>
        <div className="kpi"><div className="kpi-label">Dönem Kullanım</div><div className="kpi-val rd">{kodDonem}</div><div className="kpi-sub">seçili aralıkta</div></div>
      </div>

      {/* Bilet Türü + Seans */}
      <div className="dash-grid">
        <div className="panel">
          <div className="panel-title">Bilet Türü Dağılımı</div>
          <DonutChart data={donutData} />
        </div>
        <div className="panel">
          <div className="panel-title">Seans Bazlı Satış</div>
          <div>
            {seansData.map((s, i) => (
              <div key={s.saat} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom: i < seansData.length-1 ? '1px solid var(--bd)' : 'none' }}>
                <span style={{ fontFamily:'var(--mo)', fontSize:13, color:'var(--mu)' }}>{s.saat}</span>
                <span style={{ fontSize:18, fontWeight:700, fontFamily:'var(--mo)' }}>{s.bilet}</span>
                <span style={{ fontFamily:'var(--mo)', color:'var(--gn)', fontSize:13 }}>{fmtMoney(s.gelir)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* İndirim Kodu Durumu */}
      <div className="panel">
        <div className="panel-title" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>İndirim Kodu Durumu</span>
          <span style={{ fontFamily:'var(--mo)', fontSize:12, fontWeight:400 }}>
            <span style={{ color:'var(--rd)' }}>{kodKullanilan} kullanıldı</span>
            {' · '}
            <span style={{ color:'var(--gn)' }}>{kodAktif} kaldı</span>
          </span>
        </div>
        <div style={{ marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:13 }}>Toplam Stok</span>
            <span style={{ fontFamily:'var(--mo)', fontSize:12, color:'var(--mu)' }}>%{totalPct}</span>
          </div>
          <div style={{ height:6, background:'var(--sf3)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:99, width:`${totalPct}%`, background: totalPct >= 80 ? 'var(--rd)' : totalPct >= 50 ? 'var(--bl)' : 'var(--gn)', transition:'width .7s' }} />
          </div>
        </div>
        {grupData.length > 0 && grupData.map(g => {
          const pct = g.toplam > 0 ? Math.round(g.kullanilan / g.toplam * 100) : 0;
          return (
            <div key={g.name} style={{ background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 14px', marginTop:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:13, fontWeight:600 }}>{g.name}</span>
                <span style={{ fontFamily:'var(--mo)', fontSize:12, color:'var(--mu)' }}>{g.kullanilan}/{g.toplam}</span>
              </div>
              <div style={{ height:4, background:'var(--bd)', borderRadius:99, overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background: pct >= 80 ? 'var(--rd)' : pct >= 50 ? 'var(--bl)' : 'var(--gn)' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Kurumsal Paketler */}
      {kurumsalPaketler.length > 0 && (
        <div className="panel">
          <div className="panel-title">🏢 Kurumsal Paketler</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {kurumsalPaketler.map(p => {
              const kullanilanAdet = p.kullanilanAdet ?? 0;
              const pct = p.adet > 0 ? Math.round(kullanilanAdet / p.adet * 100) : 0;
              return (
                <div key={p._key} style={{ background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:10, padding:'1rem' }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{p.firma}</div>
                  <div style={{ fontSize:11, color:'var(--mu)', marginBottom:10 }}>{p.baslangic} — {p.bitis}</div>
                  <div style={{ fontSize:28, fontWeight:700, color:'var(--ac)', fontFamily:'var(--mo)' }}>{kullanilanAdet}<span style={{ fontSize:16, color:'var(--mu)', fontWeight:400 }}>/{p.adet ?? 0}</span></div>
                  <div style={{ height:4, background:'var(--bd)', borderRadius:99, overflow:'hidden', marginTop:8 }}>
                    <div style={{ height:'100%', borderRadius:99, width:`${pct}%`, background: pct >= 80 ? 'var(--rd)' : 'var(--gn)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Vito Komisyon */}
      {vitoRapor.length > 0 && (
        <div className="panel" style={{ marginTop:'1.5rem' }}>
          <div className="panel-title" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>🚐 Vito Komisyon Raporu</span>
          </div>
          <div style={{ display:'flex', marginBottom:'.75rem', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ flex:1, padding:14, textAlign:'center', borderRight:'1px solid var(--bd)' }}>
              <div style={{ fontSize:10, color:'var(--mu)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Toplam Tur</div>
              <div style={{ fontSize:26, fontWeight:700, fontFamily:'var(--mo)' }}>{vitoRapor.reduce((s,v) => s+v.turSayisi, 0)}</div>
            </div>
            <div style={{ flex:1, padding:14, textAlign:'center', borderRight:'1px solid var(--bd)' }}>
              <div style={{ fontSize:10, color:'var(--mu)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Toplam Kişi</div>
              <div style={{ fontSize:26, fontWeight:700, fontFamily:'var(--mo)' }}>{vitoRapor.reduce((s,v) => s+v.toplamKisi, 0)}</div>
            </div>
            <div style={{ flex:1, padding:14, textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--mu)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Toplam Hakediş</div>
              <div style={{ fontSize:22, fontWeight:700, color:'var(--ac)', fontFamily:'var(--mo)' }}>{fmtMoney(vitoRapor.reduce((s,v) => s+v.toplamHakedis, 0))}</div>
            </div>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Sürücü</th><th>Tarih</th><th>Seans</th><th>Kişi</th><th>Hakediş</th><th>Ödeme</th></tr></thead>
              <tbody>
                {vitoRapor.flatMap(v => v.turler.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight:600 }}>{v.driver.ad}</td>
                    <td className="dc">{t.tarih}</td>
                    <td style={{ fontFamily:'var(--mo)' }}>{t.seans}</td>
                    <td style={{ fontFamily:'var(--mo)' }}>{(t.tam||0)+(t.cocuk||0)+(t.yabanci||0)}</td>
                    <td style={{ color:'var(--bl)', fontFamily:'var(--mo)', fontWeight:700 }}>{fmtMoney(t.vitoKomisyon||0)}</td>
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
