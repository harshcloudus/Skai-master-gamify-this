import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';

const TABLE_TO_QUERY_KEYS: Record<string, string[][]> = {
  menu_items: [['menu-items']],
  calls: [['calls'], ['dashboard-overview']],
  orders: [['calls'], ['dashboard-overview']],
  order_items: [['calls'], ['dashboard-overview']],
  restaurant_settings: [['settings']],
  business_hours: [['settings']],
  restaurants: [['settings'], ['dashboard-overview']],
};

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('db-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          const table = payload.table;
          const keys = TABLE_TO_QUERY_KEYS[table];
          if (keys) {
            keys.forEach((key) =>
              queryClient.invalidateQueries({ queryKey: key }),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
