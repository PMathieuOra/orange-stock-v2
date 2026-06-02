import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from '../contexts/SessionContext';

// Hook : récupère le stock consolidé (conso + câbles) pour le scope actif
export function useStock() {
  const { service, magasin } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStock = useCallback(async () => {
    if (!service || !magasin) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('v_stock_consolide')
      .select('*')
      .eq('service_id', service)
      .eq('magasin_id', magasin)
      .order('nom');
    if (error) setError(error.message);
    else setItems(data || []);
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
