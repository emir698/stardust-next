'use client';

import { useState, useMemo } from 'react';
import { ref, update, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useCodes, useBatches } from '@/hooks/useFirebaseData';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { todayStr } from '@/lib/utils';
import type { CodeBatch } from '@/types';

const PAGE_SIZE = 25;

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-mu uppercase tracking-widest mb-4">{children}</p>;
}

export default function DiscountCodesPage() {
  const codes   = useCodes();
  const batches = useBatches();

  const [search, setSearch]       = useState('');
  const [durumFilter, setDurum]   = useState<'hepsi'|'aktif'|'deaktif'>('hepsi');
  const [grupFilter, setGrup]     = useState('hepsi');
  const [page, setPage]           = useState(0);

  const [topluModal, setTopluModal] = useState(false);
  const [topluInput, setTopluInput] = useState('');

  const [batchModal, setBatchModal] = useState(false);
  const [batchName, setBatchName]   = useState('');
  const [batchIndirim, setBatchIndirim] = useState('10');
  const [batchCodes, setBatchCodes] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);

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
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const aktif   = codes.filter(c => c?.status === 'aktif').length;
  const deaktif = codes.length - aktif;
  const pct = codes.length > 0 ? Math.round(deaktif / codes.length * 100) : 0;

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
    <div className="space-y-6">

      {/* ─── KPI ─── */}
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card rounded-2xl p-6 text-center hover-lift">
          <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Toplam</div>
          <div className="font-mono text-3xl font-semibold text-tx">{codes.length}</div>
        </div>
        <div className="glass-card rounded-2xl p-6 text-center hover-lift">
          <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Aktif</div>
          <div className="font-mono text-3xl font-semibold text-gn">{aktif}</div>
        </div>
        <div className="glass-card rounded-2xl p-6 text-center hover-lift">
          <div className="text-[11px] text-mu uppercase tracking-widest mb-3">Kullanılan</div>
          <div className="font-mono text-3xl font-semibold text-rd">
            {deaktif}
            <span className="text-mu text-base font-normal ml-2">(%{pct})</span>
          </div>
        </div>
      </div>

      {/* ─── Araçlar ─── */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-48">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mu text-sm">🔍</span>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Kod veya grup ara..."
              className="w-full bg-sf2 border border-bd rounded-xl pl-10 pr-4 py-2.5 text-tx font-mono text-sm outline-none focus:border-ac"
            />
          </div>
          <select
            value={durumFilter}
            onChange={e => { setDurum(e.target.value as typeof durumFilter); setPage(0); }}
            className="bg-sf2 border border-bd rounded-xl px-4 py-2.5 text-tx text-sm outline-none cursor-pointer"
          >
            <option value="hepsi">Tüm Kodlar</option>
            <option value="aktif">Sadece Aktif</option>
            <option value="deaktif">Sadece Deaktif</option>
          </select>
          <select
            value={grupFilter}
            onChange={e => { setGrup(e.target.value); setPage(0); }}
            className="bg-sf2 border border-bd rounded-xl px-4 py-2.5 text-tx text-sm outline-none cursor-pointer"
          >
            <option value="hepsi">Tüm Gruplar</option>
            {gruplar.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <Button variant="danger" size="sm" onClick={() => setTopluModal(true)}>Toplu Deaktif</Button>
          <Button variant="accent" size="sm" onClick={() => setBatchModal(true)}>+ Yeni Grup</Button>
        </div>
      </div>

      {/* ─── Tablo ─── */}
      <div>
        <SectionHeader>Kod Listesi</SectionHeader>
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-bd">
                {['#','Kod','Grup','İndirim','Durum','Kullanan','Tarih','İşlem'].map(h => (
                  <th key={h} className="px-5 py-4 text-left text-[10px] font-semibold text-mu uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-mu">Kod bulunamadı</td></tr>
              ) : paged.map((c, idx) => (
                <tr key={c._key} className="border-b border-bd last:border-0 hover:bg-sf2/60 transition-colors">
                  <td className="px-5 py-3.5 text-xs text-mu">{page * PAGE_SIZE + idx + 1}</td>
                  <td className="px-5 py-3.5 font-mono text-[13px] text-ac tracking-wide">{c.code}</td>
                  <td className="px-5 py-3.5 text-xs text-mu">{c.group ?? '—'}</td>
                  <td className="px-5 py-3.5 text-xs font-mono font-semibold">%{c.indirim ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <Badge variant={c.status === 'aktif' ? 'active' : 'inactive'}>
                      {c.status === 'aktif' ? 'Aktif' : 'Kullanıldı'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-xs">{c.kullanan ?? '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-mu font-mono">{c.date || '—'}</td>
                  <td className="px-5 py-3.5">
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

        {/* Sayfalama */}
        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-mu font-mono">
            {filtered.length} kod · Sayfa {page + 1}/{Math.max(1, totalPages)}
          </span>
          <div className="flex gap-2">
            <Button size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Önceki</Button>
            <Button size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sonraki →</Button>
          </div>
        </div>
      </div>

      {/* ─── Kod Grupları ─── */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <SectionHeader>Kod Grupları</SectionHeader>
          <Button variant="accent" size="sm" onClick={() => setBatchModal(true)}>+ Yeni Grup Ekle</Button>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          {batches.length === 0 ? (
            <div className="text-mu text-sm text-center py-10">Henüz grup yok</div>
          ) : (
            <div className="divide-y divide-bd">
              {batches.map(b => {
                const tot = (b.codes || []).length;
                const kul = codes.filter(c => c.batchKey === b._key || c.group === b.name).filter(c => c.status === 'deaktif').length;
                const grpPct = tot > 0 ? Math.round(kul / tot * 100) : 0;
                return (
                  <div key={b._key} className="flex items-center justify-between px-6 py-5 hover:bg-sf2/40 transition-colors">
                    <div>
                      <div className="font-semibold text-[14px]">{b.name}</div>
                      <div className="text-xs text-mu mt-1 font-mono">
                        %{b.indirim} indirim · {kul}/{tot} kullanıldı
                        {grpPct >= 80 && <span className="text-rd ml-2">(Stok azalıyor)</span>}
                      </div>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => handleBatchDelete(b._key, b.name)}>Sil</Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Toplu Deaktif Modal ─── */}
      <Modal open={topluModal} onClose={() => setTopluModal(false)} title="Toplu Deaktif">
        <p className="text-sm text-mu mb-4">Virgülle ayırarak kodları girin.</p>
        <textarea
          value={topluInput}
          onChange={e => setTopluInput(e.target.value)}
          rows={4}
          placeholder="FFE5B8C7207, ABC1234DEF5, ..."
          className="w-full bg-bg border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none focus:border-ac resize-none font-mono"
        />
        <ModalActions>
          <Button variant="ghost" onClick={() => setTopluModal(false)}>İptal</Button>
          <Button variant="danger" onClick={handleToplu}>Deaktif Et</Button>
        </ModalActions>
      </Modal>

      {/* ─── Yeni Grup Modal ─── */}
      <Modal open={batchModal} onClose={() => setBatchModal(false)} title="Yeni Kod Grubu Ekle" width="max-w-2xl">
        <p className="text-sm text-mu mb-5">Kodları virgül veya satır ile ayırarak girin.</p>
        <div className="space-y-4 mb-5">
          <div>
            <label className="text-[11px] font-semibold text-mu uppercase tracking-wide block mb-2">Grup Adı</label>
            <input
              value={batchName}
              onChange={e => setBatchName(e.target.value)}
              placeholder="Örn: Firma A, VIP Davetiyeler..."
              className="w-full bg-bg border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none focus:border-ac"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-mu uppercase tracking-wide block mb-2">İndirim Oranı</label>
            <select
              value={batchIndirim}
              onChange={e => setBatchIndirim(e.target.value)}
              className="w-full bg-bg border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none"
            >
              {[5,10,15,20,25,30,50,100].map(v => (
                <option key={v} value={String(v)}>{v === 100 ? '%100 (Ücretsiz)' : `%${v}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-mu uppercase tracking-wide block mb-2">Kodlar</label>
            <textarea
              value={batchCodes}
              onChange={e => setBatchCodes(e.target.value)}
              rows={6}
              placeholder="ALISTZ9IK6M, ALISTJXFO2O&#10;veya her satıra bir kod..."
              className="w-full bg-bg border border-bd rounded-xl px-4 py-3 text-tx text-sm outline-none focus:border-ac resize-none font-mono"
            />
            <div className="text-xs text-mu mt-2">{parseBatchCodes(batchCodes).length} kod</div>
          </div>
        </div>
        <ModalActions>
          <Button variant="ghost" onClick={() => setBatchModal(false)}>İptal</Button>
          <Button variant="accent" onClick={handleBatchSave} disabled={batchSaving}>
            {batchSaving ? 'Kaydediliyor...' : 'Grubu Kaydet'}
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
