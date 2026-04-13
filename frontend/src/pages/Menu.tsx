import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Terminal,
  X,
} from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { cn, longTextMono, longTextWrap } from '../lib/utils';
import { useLockBodyScroll } from '../lib/use-lock-body-scroll';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { MenuItem, MenuItemUpdate } from '../types/api';
import { TableSkeletonRows } from '../components/skeletons';

export default function Menu() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [tab, setTab] = useState<'active' | 'inactive'>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useLockBodyScroll(!!editingItem);

  useEffect(() => {
    if (!editingItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingItem]);

  useEffect(() => {
    if (!editingItem) return;
    setEditTitle(editingItem.title || '');
    setEditDesc(editingItem.description || '');
  }, [editingItem]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  useEffect(() => {
    function calcPageSize() {
      const ROW_HEIGHT = 57;
      const CHROME_HEIGHT = 340;
      const available = window.innerHeight - CHROME_HEIGHT;
      setPageSize(Math.max(3, Math.floor(available / ROW_HEIGHT)));
    }
    calcPageSize();
    window.addEventListener('resize', calcPageSize);
    return () => window.removeEventListener('resize', calcPageSize);
  }, []);

  const activeFilter = tab === 'active' ? true : false;

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu-items', activeFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('active', String(activeFilter));
      if (search.trim()) params.set('search', search.trim());
      const res = await api.get<MenuItem[]>(
        `/api/v1/menu/items?${params}`,
      );
      return res.data;
    },
  });

  const totalPages = Math.max(
    1,
    Math.ceil(menuItems.length / pageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = menuItems.slice(startIndex, startIndex + pageSize);
  const showingFrom =
    menuItems.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(
    startIndex + pageSize,
    menuItems.length,
  );

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: MenuItemUpdate;
    }) => api.patch<MenuItem>(`/api/v1/menu/items/${id}`, updates),
    onSuccess: async (res, vars) => {
      const updated = res.data;
      if (updated) {
        queryClient.setQueriesData(
          { queryKey: ['menu-items'] },
          (old: MenuItem[] | undefined) => {
            if (!old) return old;
            return old.map((it) =>
              it.id === vars.id ? { ...it, ...updated } : it,
            );
          },
        );
      }
      await queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });

  const resyncMutation = useMutation({
    mutationFn: () => api.post('/api/v1/menu/resync'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });

  function handleToggleActive(item: MenuItem) {
    updateMutation.mutate({
      id: item.id,
      updates: { is_active: !item.is_active },
    });
  }

  async function handleSaveEdit() {
    if (!editingItem) return;
    try {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        updates: {
          title: editTitle.trim() || null,
          description: editDesc.trim() || null,
        },
      });
    } finally {
      // Close the modal even if cache update/invalidation fails after a successful request.
      setEditingItem(null);
    }
  }

  const lastSyncedLabel = useMemo(() => {
    return new Date().toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  return (
    <div className="min-h-0 min-w-0 w-full flex-1">
      <main className="mx-auto max-w-[1600px] min-w-0 px-4 py-4 sm:px-6 sm:py-6 lg:p-8">
        <div className="flex flex-col gap-4 mb-10">
          <div>
            <h1 className="font-headline text-2xl font-extrabold text-on-surface">
              Menu Items
            </h1>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
            <div className="glass-panel flex w-full min-w-0 items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-on-surface transition-all lg:max-w-[640px]">
              <Search className="h-4 w-4 shrink-0 text-primary" />
              <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-on-surface-variant/80">
                Search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-transparent px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/85 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:justify-end">
              <p
                className={cn(
                  'text-xs font-semibold text-on-surface-variant sm:whitespace-nowrap',
                  longTextWrap,
                )}
              >
                Menu updated {lastSyncedLabel}
              </p>
              <button
                type="button"
                onClick={() => resyncMutation.mutate()}
                disabled={resyncMutation.isPending}
                className="bg-surface-container-low border border-outline-variant text-on-surface px-4 py-2 rounded-lg text-xs font-bold hover:bg-surface-bright transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                <RefreshCw
                  className={cn(
                    'w-4 h-4',
                    resyncMutation.isPending && 'animate-spin',
                  )}
                />
                {resyncMutation.isPending ? 'Syncing…' : 'Resync'}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex gap-8 border-b border-outline-variant">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={cn(
                'pb-4 text-sm font-semibold border-b-2 border-transparent transition-colors tracking-wide',
                tab === 'active'
                  ? 'font-bold border-primary text-primary'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              Active Items
            </button>
            <button
              type="button"
              onClick={() => setTab('inactive')}
              className={cn(
                'pb-4 text-sm font-semibold border-b-2 border-transparent transition-colors tracking-wide',
                tab === 'inactive'
                  ? 'font-bold border-primary text-primary'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              Inactive Items
            </button>
          </div>
        </div>

        <div className="relative z-0 w-full min-w-0">
          <div className="glass-panel relative overflow-hidden rounded-xl shadow-2xl">
            <div className="space-y-3 p-4 sm:hidden">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-outline-variant bg-surface-container-low/80 p-4"
                    >
                      <div className="mb-3 flex justify-between gap-3">
                        <Skeleton className="h-5 flex-1 rounded-md" />
                        <Skeleton className="h-8 w-14 shrink-0 rounded-full" />
                      </div>
                      <Skeleton className="mb-3 h-8 w-full max-w-[220px] rounded-lg" />
                      <Skeleton className="mb-2 h-3 w-24 rounded" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="mt-3 h-9 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : pageItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-on-surface-variant">
                  No items found
                </p>
              ) : (
                pageItems.map((item) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setEditingItem(item);
                      }
                    }}
                    className="w-full min-w-0 cursor-pointer overflow-x-hidden rounded-xl border border-outline-variant bg-surface-container-low/80 p-4 outline-none transition-colors hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 pr-1">
                        <p
                          className={cn(
                            'line-clamp-4 font-headline text-sm font-bold leading-snug text-on-surface',
                            longTextWrap,
                          )}
                          title={item.title || item.pos_name}
                        >
                          {item.title || item.pos_name}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-xs font-bold tracking-widest text-secondary">
                          {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(item);
                          }}
                          className={cn(
                            'relative h-5 w-10 shrink-0 cursor-pointer rounded-full transition-colors',
                            item.is_active ? 'bg-primary' : 'bg-surface-bright',
                          )}
                          aria-label={
                            item.is_active
                              ? 'Deactivate item'
                              : 'Activate item'
                          }
                        >
                          <div
                            className={cn(
                              'absolute top-1 h-3 w-3 rounded-full',
                              item.is_active
                                ? 'right-1 bg-white'
                                : 'left-1 bg-on-surface-variant',
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    <div className="mb-3 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                        POS Name
                      </p>
                      <span
                        className={cn(
                          'mt-1 block w-full whitespace-normal rounded-lg border border-outline-variant bg-surface-container-low px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider text-on-surface-variant/85',
                          longTextMono,
                        )}
                        title={item.pos_name}
                      >
                        {item.pos_name}
                      </span>
                    </div>
                    <div className="min-w-0 border-t border-outline-variant/60 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
                        Description
                      </p>
                      <p
                        className={cn(
                          'mt-1 line-clamp-6 text-sm leading-relaxed text-on-surface',
                          longTextWrap,
                        )}
                        title={
                          item.description?.trim()
                            ? item.description
                            : undefined
                        }
                      >
                        {item.description?.trim()
                          ? item.description
                          : '—'}
                      </p>
                    </div>
                    <div
                      role="presentation"
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface pointer-events-none"
                    >
                      Edit item
                      <ChevronRight className="h-4 w-4 text-on-surface-variant/85" />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden w-full min-w-0 overflow-x-auto sm:block">
              <div className="min-w-[640px] sm:min-w-0">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  POS Name
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Display Title
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Description
                </th>
                <th className="py-4 px-6 text-xs font-bold text-on-surface-variant uppercase tracking-widest text-right">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <TableSkeletonRows columns={4} rows={10} lastColumnAlignEnd />
              ) : pageItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-on-surface-variant text-sm"
                  >
                    No items found
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setEditingItem(item)}
                    className="hover:bg-surface-container-low transition-colors group cursor-pointer"
                  >
                    <td className="min-w-0 max-w-[min(28vw,14rem)] py-4 px-6 align-top sm:max-w-none">
                      <span
                        className={cn(
                          'inline-block max-w-full rounded-lg border border-outline-variant bg-surface-container-low px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider text-on-surface-variant/85',
                          longTextMono,
                        )}
                      >
                        {item.pos_name}
                      </span>
                    </td>
                    <td className="min-w-0 py-4 px-6">
                      <p
                        className={cn(
                          'text-sm font-bold text-on-surface transition-colors group-hover:text-primary font-headline',
                          longTextWrap,
                        )}
                      >
                        {item.title || item.pos_name}
                      </p>
                    </td>
                    <td className="min-w-0 max-w-[min(40vw,18rem)] py-4 px-6 sm:max-w-xs">
                      <p
                        className={cn(
                          'text-xs font-medium text-on-surface-variant line-clamp-2 sm:line-clamp-3',
                          longTextWrap,
                        )}
                      >
                        {item.description || '—'}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end items-center gap-4">
                        <span className="text-xs font-bold text-secondary tracking-widest">
                          {item.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(item);
                          }}
                          className={cn(
                            'w-10 h-5 rounded-full relative cursor-pointer transition-colors',
                            item.is_active
                              ? 'bg-primary'
                              : 'bg-surface-bright',
                          )}
                          aria-label={
                            item.is_active
                              ? 'Deactivate item'
                              : 'Activate item'
                          }
                        >
                          <div
                            className={cn(
                              'absolute top-1 w-3 h-3 rounded-full',
                              item.is_active
                                ? 'right-1 bg-white'
                                : 'left-1 bg-on-surface-variant',
                            )}
                          ></div>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3 border-t border-outline-variant bg-surface-container-low px-4 py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left sm:px-8">
            <p className="text-xs text-on-surface-variant">
              Showing{' '}
              <span className="text-on-surface font-bold">
                {showingFrom} - {showingTo}
              </span>{' '}
              of{' '}
              <span className="text-on-surface font-bold">
                {menuItems.length}
              </span>{' '}
              entries
            </p>
            <div className="flex items-center space-x-2">
              <button
                className="w-8 h-8 rounded bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant disabled:opacity-30 disabled:hover:text-on-surface-variant"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-on-surface-variant">
                Page{' '}
                <span className="text-on-surface">{currentPage}</span>{' '}
                / {totalPages}
              </span>
              <button
                className="w-8 h-8 rounded bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant disabled:opacity-30 disabled:hover:text-on-surface-variant"
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          </div>
        </div>
      </main>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <div
            className="fixed inset-0 z-500 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-3 sm:p-4"
            onClick={() => setEditingItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl bg-surface-container-high rounded-xl shadow-2xl border border-outline-variant overflow-hidden max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 sm:px-8 py-4 sm:py-6 border-b border-outline-variant flex justify-between items-center">
                <h2 className="font-headline text-xl font-bold text-on-surface">
                  Edit Menu Item
                </h2>
                <button
                  onClick={() => setEditingItem(null)}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="px-5 sm:px-8 py-5 sm:py-8 space-y-6 overflow-y-auto">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    POS Name
                  </label>
                  <div className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
                    <Terminal className="h-4 w-4 shrink-0 text-primary/80" />
                    <span
                      className={cn(
                        'min-w-0 flex-1 font-mono text-sm font-medium text-on-surface',
                        longTextMono,
                      )}
                    >
                      {editingItem.pos_name}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant italic">
                    System generated. Cannot be modified.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Display Title
                  </label>
                  <input
                    className="w-full sunken-input font-headline font-semibold"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                    Public Description
                  </label>
                  <textarea
                    className="w-full sunken-input font-body text-sm resize-none"
                    rows={5}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                  />
                </div>
              </div>

              <div className="px-5 sm:px-8 py-4 sm:py-6 bg-surface-container-highest flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-6 py-2 bg-surface-bright text-on-surface rounded-lg font-semibold hover:bg-surface-container transition-colors"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending}
                  className="px-8 py-2 bg-linear-to-r from-primary to-primary-container text-white rounded-lg font-bold hover:scale-95 transition-transform shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {updateMutation.isPending
                    ? 'Saving…'
                    : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
