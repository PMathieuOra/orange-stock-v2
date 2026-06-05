import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from '../contexts/SessionContext';

// Hook : récupère le stock consolidé (conso + câbles) pour le scope actif
// Pour les câbles, récupère aussi la liste des tourets (pour le diagramme)
export function useStock() {
  const { service, magasin } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStock = useCallback(async () => {
    if (!service || !magasin) return;
    setLoading(true);
    setError(null);

    // Charger en parallèle : vue consolidée + tous les tourets du scope
    const [stockRes, touretsRes] = await Promise.all([
      supabase
        .from('v_stock_consolide')
        .select('*')
        .eq('service_id', service)
        .eq('magasin_id', magasin)
        .order('nom'),
      // On joint sur types_cable pour filtrer par service+magasin
      supabase
        .from('tourets')
        .select('id, ref_touret, initiale, restante, type_cable_id, types_cable!inner(service_id, magasin_id, ref_type)')
        .eq('types_cable.service_id', service)
        .eq('types_cable.magasin_id', magasin),
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
        id: t.id,
        ref_touret: t.ref_touret,
        initiale: t.initiale,
        restante: t.restante,
      });
    });

    // Enrichir les câbles avec leurs tourets
    const enriched = stockItems.map((it) => {
      if (it.type === 'cable') {
        return { ...it, tourets: touretsByCableId[it.id] || [] };
      }
      return it;
    });

    setItems(enriched);
    setLoading(false);
  }, [service, magasin]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  return { items, loading, error, refetch: fetchStock };
}

// Hook générique : récupère une table filtrée par scope
export function useScopedTable(table, { select = '*', extraFilter, orderBy } = {}) {
  const { service, magasin } = useSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!service || !magasin) return;
    setLoading(true);
    setError(null);
    let q = supabase.from(table).select(select).eq('service_id', service).eq('magasin_id', magasin);
    if (orderBy) q = q.order(orderBy);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setRows((data || []).filter(extraFilter || (() => true)));
    setLoading(false);
  }, [table, select, service, magasin, orderBy, extraFilter]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rows, loading, error, refetch: fetch };
}
