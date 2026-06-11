'use client';

import { useState, useMemo } from 'react';
import { ref, update, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useCodes, useBatches } from '@/hooks/useFirebaseData';
import { Button } from '@/components/ui/Button';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { todayStr } from '@/lib/utils';
import type { CodeBatch } from '@/types';

const PAGE_SIZE = 25;

export default function DiscountCodesPage() {
  const codes   = useCodes();
  const batches = useBatches();

  const [search, setSearch]       = useState('');
  const [durumFilter, setDurum]   = useState<'hepsi'|'aktif'|'deaktif'>('hepsi');
  const [grupFilter, setGrup]     = useState('hepsi');
  const [page, setPage]           = useState(0);

  const [topluModal, setTopluModal] = useState(false);
  const [topluInput, setTopluInput] = useState('');

  const [batchModal, setBatchModal]       = useState(false);
  const [batchName, setBatchName]         = useState('');
  const [batchIndirim, setBatchIndirim]   = useState('10');
  const [batchCodes, setBatchCodes]       = useState('');
  const [batchSaving, setBatchSaving]     = useState(false);

  const gruplar = useMemo(() => {
    const gs = new Set<string>();
    codes.forEach(c => { if (c.group) gs.add(c.group); });
    batches.forEach(b => gs.add(b.name));
    return Array.from(gs).sort();
  }, [codes, batches]);

  const filtered = useMemo(() => {
    return codes.filter(c => {
      if (!c) return false;
      if (search && !c.code?.toLowerCase().includes(search.toLowerCase()) &&
          !(c.group ?? '').toLowerCase().includes(search.toLowerCase())) return false;
      if (durumFilter === 'aktif'   && c.status !== 'aktif')   return false;
      if (durumFilter === 'deaktif' && c.status !== 'deaktif') return false;
      if (grupFilter !== 'hepsi' && (c.group ?? c.batchKey) !== grupFilter) return false;
      return true;
    });
  }, [codes, search, durumFilter, grupFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const aktif   = codes.filter(c => c?.status === 'aktif').length;
  const deaktif = codes.length - aktif;
  const pct     = codes.length > 0 ? Math.round(deaktif / codes.length * 100) : 0;

  async function handleDeaktif(key: string, code: string) {
    if (!confirm(`"${code}" deaktif edilsin mi?`)) return;
    await update(ref(db, `codes/${key}`), { status: 'deaktif', date: todayStr() });
    toast('Deaktif edildi', 'ok');
  }

  async function handleAktif(key: string) {
    await update(ref(db, `codes/${key}`), { status: 'aktif', date: '', kullanan: '' });
    toast('Aktif edildi', 'ok');
  }

  async function handleToplu() {
    const list = topluInput.split(/[,\n]/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!list.length) { toast('En az bir kod girin', 'err'); return; }
    const now = todayStr();
    let count = 0;
    for (const kod of list) {
      const found = codes.find(c => c?.code === kod && c.status === 'aktif');
      if (found) {
        await update(ref(db, `codes/${found._key}`), { status: 'deaktif', date: now });
        count++;
      }
    }
    toast(`${count} kod deaktif edildi`, 'ok');
    setTopluModal(false);
    setTopluInput('');
  }

  function parseBatchCodes(text: string): string[] {
    return text.split(/[,\n\r]/).map(s => s.trim().toUpperCase()).filter(Boolean);
  }

  async function handleBatchSave() {
    const list = parseBatchCodes(batchCodes);
    if (!batchName.trim()) { toast('Grup adı girin', 'err'); return; }
    if (!list.length) { toast('En az bir kod girin', 'err'); return; }
    setBatchSaving(true);
    const batchKey = Date.now().toString(36).toUpperCase();
    const batch: Omit<CodeBatch, '_key'> = {
      name: batchName.trim(),
      indirim: parseInt(batchIndirim, 10),
      codes: list,
      createdAt: todayStr(),
    };
    await set(ref(db, `codeBatches/${batchKey}`), batch);
    const updates: Record<string, unknown> = {};
    list.forEach(code => {
      const ckey = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
      updates[`codes/${ckey}`] = {
        code, group: batchName.trim(), batchKey,
        indirim: parseInt(batchIndirim, 10),
        status: 'aktif', kullanan: '', date: '',
      };
    });
    await update(ref(db), updates);
    toast(`${list.length} kod eklendi`, 'ok');
    setBatchModal(false);
    setBatchName(''); setBatchCodes(''); setBatchIndirim('10');
    setBatchSaving(false);
  }

  async function handleBatchDelete(key: string, name: string) {
    if (!confirm(`"${name}" grubundaki TÜM kodlar silinecek. Emin misiniz?`)) return;
    const batch = batches.find(b => b._key === key);
    if (!batch) return;
    const updates: Record<string, null> = { [`codeBatches/${key}`]: null };
    codes.filter(c => c.batchKey === key || c.group === batch.name).forEach(c => {
      updates[`codes/${c._key}`] = null;
    });
    await update(ref(db), updates as Record<string, unknown>);
    toast('Grup silindi', 'ok');
  }

  return (
    <div>
      {/* KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:0, background:'var(--sf)', border:'1px solid var(--bd)', borderRadius:12, padding:'1rem', marginBottom:'1.25rem' }}>
        <div className="kpi" style={{ border:'none', borderRight:'1px solid var(--bd)', borderRadius:0, background:'transparent' }}>
          <div className="kpi-label">Toplam</div>
          <div className="kpi-val">{codes.length}</div>
        </div>
        <div className="kpi" style={{ border:'none', borderRight:'1px solid var(--bd)', borderRadius:0, background:'transparent' }}>
          <div className="kpi-label">Aktif</div>
          <div className="kpi-val gn">{aktif}</div>
        </div>
        <div className="kpi" style={{ border:'none', borderRadius:0, background:'transparent' }}>
          <div className="kpi-label">Kullanılan</div>
          <div className="kpi-val rd">{deaktif} <span style={{ fontSize:14, color:'var(--mu)', fontWeight:400 }}>(%{pct})</span></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <input
          type="text"
          className="form-input si"
          placeholder="Kod veya grup ara..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <select className="sw" value={durumFilter} onChange={e => { setDurum(e.target.value as typeof durumFilter); setPage(0); }}>
          <option value="hepsi">Tüm Kodlar</option>
          <option value="aktif">Sadece Aktif</option>
          <option value="deaktif">Sadece Deaktif</option>
        </select>
        <select className="sw" value={grupFilter} onChange={e => { setGrup(e.target.value); setPage(0); }}>
          <option value="hepsi">Tüm Gruplar</option>
          {gruplar.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <Button variant="danger" size="sm" onClick={() => setTopluModal(true)}>Toplu Deaktif</Button>
        <Button variant="accent" size="sm" onClick={() => setBatchModal(true)}>+ Yeni Grup</Button>
      </div>

      {/* Tablo */}
      <div className="panel" style={{ marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
          <div className="panel-title" style={{ margin:0 }}>Kod Listesi</div>
          <div className="pag">
            <span style={{ fontSize:12, color:'var(--mu)', fontFamily:'var(--mo)' }}>{filtered.length} kod</span>
            <Button size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</Button>
            <span style={{ fontSize:12, color:'var(--mu)', fontFamily:'var(--mo)' }}>{page + 1}/{Math.max(1, totalPages)}</span>
            <Button size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sonraki →</Button>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>#</th><th>Kod</th><th>Grup</th><th>İndirim</th><th>Durum</th><th>Kullanan</th><th>Tarih</th><th>İşlem</th></tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign:'center', padding:'2rem', color:'var(--mu)' }}>Kod bulunamadı</td></tr>
              ) : paged.map((c, idx) => (
                <tr key={c._key}>
                  <td className="dc">{page * PAGE_SIZE + idx + 1}</td>
                  <td className="cc">{c.code}</td>
                  <td className="dc">{c.group ?? '—'}</td>
                  <td style={{ fontFamily:'var(--mo)', fontWeight:600 }}>%{c.indirim ?? '—'}</td>
                  <td>
                    <span className={`badge ${c.status === 'aktif' ? 'ba' : 'bdd'}`}>
                      {c.status === 'aktif' ? 'Aktif' : 'Kullanıldı'}
                    </span>
                  </td>
                  <td className="dc">{c.kullanan ?? '—'}</td>
                  <td className="dc">{c.date || '—'}</td>
                  <td>
                    {c.status === 'aktif'
                      ? <Button variant="danger" size="sm" onClick={() => handleDeaktif(c._key, c.code)}>Deaktif</Button>
                      : <Button size="sm" onClick={() => handleAktif(c._key)}>Aktif Et</Button>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kod Grupları */}
      <div className="panel">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
          <div className="panel-title" style={{ margin:0 }}>Kod Grupları</div>
          <Button variant="accent" size="sm" onClick={() => setBatchModal(true)}>+ Yeni Grup</Button>
        </div>
        {batches.length === 0 ? (
          <div style={{ color:'var(--mu)', fontSize:13, textAlign:'center', padding:'2rem' }}>Henüz grup yok</div>
        ) : batches.map(b => {
          const tot = (b.codes || []).length;
          const kul = codes.filter(c => c.batchKey === b._key || c.group === b.name).filter(c => c.status === 'deaktif').length;
          const grpPct = tot > 0 ? Math.round(kul / tot * 100) : 0;
          return (
            <div key={b._key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--sf2)', border:'1px solid var(--bd)', borderRadius:8, padding:'12px 14px', marginBottom:8 }}>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{b.name}</div>
                <div style={{ fontSize:12, color:'var(--mu)', fontFamily:'var(--mo)', marginTop:2 }}>
                  %{b.indirim} · {kul}/{tot} kullanıldı
                  {grpPct >= 80 && <span style={{ color:'var(--rd)', marginLeft:8 }}>(Stok azalıyor)</span>}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleBatchDelete(b._key, b.name)}>Sil</Button>
            </div>
          );
        })}
      </div>

      {/* Toplu Deaktif Modal */}
      <Modal open={topluModal} onClose={() => setTopluModal(false)} title="Toplu Deaktif">
        <p style={{ fontSize:13, color:'var(--mu)', marginBottom:12 }}>Virgülle ayırarak kodları girin.</p>
        <textarea
          value={topluInput}
          onChange={e => setTopluInput(e.target.value)}
          rows={4}
          placeholder="FFE5B8C7207, ABC1234DEF5, ..."
          style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 12px', color:'var(--tx)', fontSize:13, fontFamily:'var(--mo)', resize:'none', outline:'none', boxSizing:'border-box' }}
        />
        <ModalActions>
          <Button variant="default" onClick={() => setTopluModal(false)}>İptal</Button>
          <Button variant="danger" onClick={handleToplu}>Deaktif Et</Button>
        </ModalActions>
      </Modal>

      {/* Yeni Grup Modal */}
      <Modal open={batchModal} onClose={() => setBatchModal(false)} title="Yeni Kod Grubu Ekle">
        <p style={{ fontSize:13, color:'var(--mu)', marginBottom:12 }}>Kodları virgül veya satır ile ayırarak girin.</p>
        <div style={{ marginBottom:12 }}>
          <label className="form-label">Grup Adı</label>
          <input className="form-input" value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Örn: Firma A, VIP Davetiyeler..." />
        </div>
        <div style={{ marginBottom:12 }}>
          <label className="form-label">İndirim Oranı</label>
          <select className="form-input" value={batchIndirim} onChange={e => setBatchIndirim(e.target.value)}>
            {[5,10,15,20,25,30,50,100].map(v => (
              <option key={v} value={String(v)}>{v === 100 ? '%100 (Ücretsiz)' : `%${v}`}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom:4 }}>
          <label className="form-label">Kodlar</label>
          <textarea
            value={batchCodes}
            onChange={e => setBatchCodes(e.target.value)}
            rows={6}
            placeholder="ALISTZ9IK6M, ALISTJXFO2O&#10;veya her satıra bir kod..."
            style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--bd)', borderRadius:8, padding:'10px 12px', color:'var(--tx)', fontSize:13, fontFamily:'var(--mo)', resize:'none', outline:'none', boxSizing:'border-box' }}
          />
          <div style={{ fontSize:11, color:'var(--mu)', marginTop:4 }}>{parseBatchCodes(batchCodes).length} kod</div>
        </div>
        <ModalActions>
          <Button variant="default" onClick={() => setBatchModal(false)}>İptal</Button>
          <Button variant="accent" onClick={handleBatchSave} disabled={batchSaving}>
            {batchSaving ? 'Kaydediliyor...' : 'Grubu Kaydet'}
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
