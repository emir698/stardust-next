'use client';

import { useEffect, useState } from 'react';
import { watchSatisList, watchPNRler, watchBiletler } from '@/lib/db/tickets';
import { watchCodes, watchBatches } from '@/lib/db/codes';
import { watchVitoDrivers } from '@/lib/db/vito';
import { watchKurumsalPaketler } from '@/lib/db/kurumsal';
import { watchUsers } from '@/lib/db/users';
import type { Satis, PNRKayit, IndirimKodu, CodeBatch, VitoDriver, KurumsalPaket, AppUser } from '@/types';

export function useSatisList() {
  const [satisList, setSatisList] = useState<Satis[]>([]);
  useEffect(() => watchSatisList(setSatisList), []);
  return satisList;
}

export function usePNRler() {
  const [pnrler, setPnrler] = useState<Record<string, PNRKayit>>({});
  useEffect(() => watchPNRler(setPnrler), []);
  return pnrler;
}

export function useCodes() {
  const [codes, setCodes] = useState<IndirimKodu[]>([]);
  useEffect(() => watchCodes(setCodes), []);
  return codes;
}

export function useBatches() {
  const [batches, setBatches] = useState<CodeBatch[]>([]);
  useEffect(() => watchBatches(setBatches), []);
  return batches;
}

export function useVitoDrivers() {
  const [drivers, setDrivers] = useState<VitoDriver[]>([]);
  useEffect(() => watchVitoDrivers(setDrivers), []);
  return drivers;
}

export function useKurumsalPaketler() {
  const [paketler, setPaketler] = useState<KurumsalPaket[]>([]);
  useEffect(() => watchKurumsalPaketler(setPaketler), []);
  return paketler;
}

export function useBiletler() {
  const [biletler, setBiletler] = useState<Record<string, import('@/types').Bilet>>({});
  useEffect(() => watchBiletler(setBiletler), []);
  return biletler;
}

export function useUsers() {
  const [users, setUsers] = useState<Array<{ uid: string; name: string; role: AppUser['role']; email?: string }>>([]);
  useEffect(() => watchUsers(setUsers), []);
  return users;
}
