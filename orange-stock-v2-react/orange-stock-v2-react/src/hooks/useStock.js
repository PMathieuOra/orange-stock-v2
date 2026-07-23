import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from '../contexts/SessionContext';

export function useStock() {
  const { services, magasin } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const servicesKey = services.join(',');

  const fetchStock = useCallback(async () => {
    if (!servicesKey || !magasin) return;
    const servicesList = servicesKey.split(',');
    setLoading(true);
    setError(null);

    const [stockRes, touretsRes] = await Promise.all([
      supabase.from('v_stock_consolide').select('*')
        .in('service_id', servicesList).eq('magasin_id', magasin).order('nom'),
      supabase.from('tourets')
        .select('id, ref_touret, initiale, restante, emplacement, type_cable_id, types_cable!inner(service_id, magasin_id, ref_type)')
        .in('types_cable.service_id', servicesList).eq('types_cable.magasin_id', magasin),
    ]);

    if (stockRes.error) {
      setError(stockRes.error.message);
      setLoading(false);
      return;
    }

    const stockItems = stockRes.data || [];
    const touretsByCableId = {};
    (touretsRes.data || []).forEach((t) => {
      if (!touretsByCableId[t.type_cable_id]) touretsByCableId[t.type_cable_id] = [];
      touretsByCableId[t.type_cable_id].push({
        id: t.id, ref_touret: t.ref_touret,
        initiale: t.initiale, restante: t.restante, emplacement: t.emplacement,
      });
    });

    const enriched = stockItems.map((it) => it.type === 'cable'
      ? { ...it, tourets: touretsByCableId[it.id] || [] } : it);

    setItems(enriched);
    setLoading(false);
  }, [servicesKey, magasin]);

  useEffect(() => { fetchStock(); }, [fetchStock]);
  return { items, loading, error, refetch: fetchStock };
}

export function usePendingOrders() {
  const { services, magasin } = useSession();
  const [pendingItems, setPendingItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const servicesKey = services.join(',');

  const fetchPending = useCallback(async () => {
    if (!servicesKey || !magasin) return;
    const servicesList = servicesKey.split(',');
    setLoading(true);

    const { data: commandes, error: errCmd } = await supabase
      .from('commandes')
      .select('id, numero, type, date_creation, statut, service_id')
      .in('service_id', servicesList)
      .eq('magasin_id', magasin)
      .eq('statut', 'en_cours')
      .order('date_creation', { ascending: false });

    if (errCmd) { console.error('Erreur fetch commandes :', errCmd); setPendingItems([]); setLoading(false); return; }
    if (!commandes || commandes.length === 0) { setPendingItems([]); setLoading(false); return; }

    const cmdIds = commandes.map((c) => c.id);
    const { data: lignes, error: errLignes } = await supabase
      .from('commande_lignes').select('id, commande_id, ref, qty_commandee, qty_recue')
      .in('commande_id', cmdIds);
    if (errLignes) { console.error('Erreur fetch lignes :', errLignes); setPendingItems([]); setLoading(false); return; }

    const lignesByCmd = {};
    (lignes || []).forEach((l) => {
      if (!lignesByCmd[l.commande_id]) lignesByCmd[l.commande_id] = [];
      lignesByCmd[l.commande_id].push(l);
    });
    commandes.forEach((c) => { c.commande_lignes = lignesByCmd[c.id] || []; });

    const consoRefs = []; const cableRefs = [];
    commandes.forEach((c) => (c.commande_lignes || []).forEach((l) => {
      if (c.type === 'cable') cableRefs.push(l.ref); else consoRefs.push(l.ref);
    }));

    const [consosInfo, cablesInfo] = await Promise.all([
      consoRefs.length > 0
        ? supabase.from('articles_conso').select('ref, nom, service_id')
            .in('service_id', servicesList).eq('magasin_id', magasin).in('ref', consoRefs)
        : Promise.resolve({ data: [] }),
      cableRefs.length > 0
        ? supabase.from('types_cable').select('ref_type, nom, categorie, service_id')
            .in('service_id', servicesList).eq('magasin_id', magasin).in('ref_type', cableRefs)
        : Promise.resolve({ data: [] }),
    ]);

    const consoMap = {};
    (consosInfo.data || []).forEach((a) => { consoMap[`${a.service_id}|${a.ref}`] = { nom: a.nom }; });
    const cableMap = {};
    (cablesInfo.data || []).forEach((a) => { cableMap[`${a.service_id}|${a.ref_type}`] = { nom: a.nom, categorie: a.categorie }; });

    const flat = [];
    commandes.forEach((c) => (c.commande_lignes || []).forEach((l) => {
      const reste = l.qty_commandee - l.qty_recue;
      if (reste <= 0) return;
      const key = `${c.service_id}|${l.ref}`;
      const info = c.type === 'cable' ? cableMap[key] : consoMap[key];
      flat.push({
        ligneId: l.id, type: c.type, ref: l.ref, service_id: c.service_id,
        nom: info?.nom || null, categorie: info?.categorie || null,
        qty_attendue: reste, unite: c.type === 'cable' ? 'm' : 'u',
        commande: { id: c.id, numero: c.numero, date_creation: c.date_creation },
      });
    }));

    setPendingItems(flat);
    setLoading(false);
  }, [servicesKey, magasin]);

  useEffect(() => { fetchPending(); }, [fetchPending]);
  return { pendingItems, loading, refetch: fetchPending };
}

export function useScopedTable(table, { select = '*', extraFilter, orderBy } = {}) {
  const { service, magasin } = useSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!service || !magasin) return;
    setLoading(true); setError(null);
    let q = supabase.from(table).select(select).eq('service_id', service).eq('magasin_id', magasin);
    if (orderBy) q = q.order(orderBy);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setRows((data || []).filter(extraFilter || (() => true)));
    setLoading(false);
  }, [table, select, service, magasin, orderBy, extraFilter]);

  useEffect(() => { fetch(); }, [fetch]);
  return { rows, loading, error, refetch: fetch };
}
