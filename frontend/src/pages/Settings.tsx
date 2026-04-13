import React from 'react';
import {
  Mic,
  Smartphone,
  MapPin,
  X,
  Minus,
  Plus,
  ChevronDown,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useLockBodyScroll } from '../lib/use-lock-body-scroll';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type {
  AllSettings,
  DayHours,
  DineInSettings as DineInSettingsType,
  TakeawaySettings as TakeawaySettingsType,
  DivertSettings as DivertSettingsType,
  SmsSettings as SmsSettingsType,
  CustomerNameSettings as CustomerNameSettingsType,
} from '../types/api';
import { SettingsPageSkeleton } from '../components/skeletons';

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function Toggle({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  onClassName = 'bg-primary',
  offClassName = 'bg-surface-bright',
  knobOnClassName = 'bg-white',
  knobOffClassName = 'bg-on-surface-variant',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  onClassName?: string;
  offClassName?: string;
  knobOnClassName?: string;
  knobOffClassName?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      className={[
        'relative h-5 w-10 rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:cursor-not-allowed',
        checked ? onClassName : offClassName,
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-1 w-3 h-3 rounded-full transition-all',
          checked ? 'right-1' : 'left-1',
          checked ? knobOnClassName : knobOffClassName,
        ].join(' ')}
      />
    </button>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { profile, refreshProfile } = useAuth();

  // Local state synced from server
  const [voiceAgentActive, setVoiceAgentActive] = React.useState(true);
  const [transferCallsDineIn, setTransferCallsDineIn] = React.useState(false);
  const [transferNumber, setTransferNumber] = React.useState('');
  const [smsWhenReady, setSmsWhenReady] = React.useState(false);
  const [maxHourlyCapacity, setMaxHourlyCapacity] = React.useState(0);
  const [takeawayEnabled, setTakeawayEnabled] = React.useState(false);
  const [takeawayMinutes, setTakeawayMinutes] = React.useState(0);
  const [takeawayMinutesDraft, setTakeawayMinutesDraft] =
    React.useState('0');
  const [divertEnabled, setDivertEnabled] = React.useState(false);
  const [divertThreshold, setDivertThreshold] = React.useState(0);
  const [askCustomerName, setAskCustomerName] = React.useState(false);
  const [locationOpen, setLocationOpen] = React.useState(false);
  const [location, setLocation] = React.useState(() => {
    try {
      return (
        window.localStorage.getItem('skai.timeZone') || 'America/New_York'
      );
    } catch {
      return 'America/New_York';
    }
  });
  const [tzQuery, setTzQuery] = React.useState('');
  const [now, setNow] = React.useState(() => new Date());
  const [businessHoursOpen, setBusinessHoursOpen] = React.useState(false);
  const [businessHours, setBusinessHours] = React.useState<
    Record<string, { from: string; to: string }>
  >({
    Monday: { from: '09:00', to: '22:00' },
    Tuesday: { from: '09:00', to: '22:00' },
    Wednesday: { from: '09:00', to: '22:00' },
    Thursday: { from: '09:00', to: '22:00' },
    Friday: { from: '09:00', to: '23:00' },
    Saturday: { from: '10:00', to: '23:00' },
    Sunday: { from: '10:00', to: '21:00' },
  });
  const businessHoursSnapshotRef = React.useRef<Record<string, { from: string; to: string }> | null>(null);
  const dineInSnapshotRef = React.useRef<{
    transferCallsDineIn: boolean;
    maxHourlyCapacity: number;
    takeReservationsAfterHours: boolean;
  } | null>(null);
  const locationWrapRef = React.useRef<HTMLDivElement>(null);

  const [dineInModalOpen, setDineInModalOpen] = React.useState(false);
  const [takeReservationsAfterHours, setTakeReservationsAfterHours] =
    React.useState(false);

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<AllSettings>('/api/v1/settings'),
    select: (res) => res.data,
  });

  // Sync local state when server data arrives
  React.useEffect(() => {
    if (!settings) return;
    setVoiceAgentActive(settings.agent_enabled);
    setTransferCallsDineIn(settings.dine_in.dinein_transfer_enabled);
    setTransferNumber(settings.dine_in.dinein_transfer_number || '');
    setMaxHourlyCapacity(
      settings.dine_in.dinein_max_hourly_capacity ?? 0,
    );
    setTakeawayEnabled(settings.takeaway.takeaway_enabled);
    const tm = settings.takeaway.takeaway_stop_minutes_before_close;
    setTakeawayMinutes(tm);
    setTakeawayMinutesDraft(String(tm));
    setDivertEnabled(settings.divert.divert_enabled);
    setDivertThreshold(settings.divert.divert_threshold_amount);
    setSmsWhenReady(settings.sms.sms_order_ready_enabled);
    setTakeReservationsAfterHours(settings.dine_in.dinein_take_reservations_after_hours ?? false);
    setAskCustomerName(settings.customer_name?.ask_customer_name ?? false);

    const hoursMap: Record<string, { from: string; to: string }> = {};
    DAY_NAMES.forEach((name, i) => {
      const day = settings.business_hours.find(
        (h) => h.day_of_week === i,
      );
      hoursMap[name] = {
        from: day?.open_time || '',
        to: day?.close_time || '',
      };
    });
    setBusinessHours(hoursMap);
  }, [settings]);

  // Sync timezone from restaurant profile
  React.useEffect(() => {
    if (profile?.restaurant?.timezone) {
      setLocation(profile.restaurant.timezone);
      try {
        window.localStorage.setItem(
          'skai.timeZone',
          profile.restaurant.timezone,
        );
      } catch {
        // ignore
      }
    }
  }, [profile]);

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useLockBodyScroll(businessHoursOpen);
  useLockBodyScroll(dineInModalOpen);
  useLockBodyScroll(locationOpen);

  React.useEffect(() => {
    if (!businessHoursOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelBusinessHours();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [businessHoursOpen]);

  React.useEffect(() => {
    if (!locationOpen) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (
        locationWrapRef.current &&
        !locationWrapRef.current.contains(t)
      ) {
        setLocationOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLocationOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [locationOpen]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem('skai.timeZone', location);
    } catch {
      // ignore
    }
  }, [location]);

  // Mutations
  const agentToggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put('/api/v1/settings/agent-toggle', { agent_enabled: enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      refreshProfile();
    },
  });

  const dineInMutation = useMutation({
    mutationFn: (data: DineInSettingsType) =>
      api.put('/api/v1/settings/dine-in', data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const takeawayMutation = useMutation({
    mutationFn: (data: TakeawaySettingsType) =>
      api.put('/api/v1/settings/takeaway', data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const divertMutation = useMutation({
    mutationFn: (data: DivertSettingsType) =>
      api.put('/api/v1/settings/divert', data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const smsMutation = useMutation({
    mutationFn: (data: SmsSettingsType) =>
      api.put('/api/v1/settings/sms', data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const customerNameMutation = useMutation({
    mutationFn: (data: CustomerNameSettingsType) =>
      api.put('/api/v1/settings/customer-name', data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const businessHoursMutation = useMutation({
    mutationFn: (hours: DayHours[]) =>
      api.put('/api/v1/settings/business-hours', { hours }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const timezoneMutation = useMutation({
    mutationFn: (timezone: string) =>
      api.put('/api/v1/settings/timezone', { timezone }),
    onSuccess: () => {
      refreshProfile();
    },
  });

  function handleAgentToggle(val: boolean) {
    setVoiceAgentActive(val);
    agentToggleMutation.mutate(val);
  }

  function handleDineInTransferToggle(val: boolean) {
    setTransferCallsDineIn(val);
  }

  function handleDineInCapacityChange(val: number) {
    setMaxHourlyCapacity(val);
  }

  function handleTakeReservationsAfterHoursToggle(val: boolean) {
    setTakeReservationsAfterHours(val);
  }

  function openDineInModal() {
    dineInSnapshotRef.current = {
      transferCallsDineIn,
      maxHourlyCapacity,
      takeReservationsAfterHours,
    };
    setDineInModalOpen(true);
  }

  function cancelDineInModal() {
    const snap = dineInSnapshotRef.current;
    if (snap) {
      setTransferCallsDineIn(snap.transferCallsDineIn);
      setMaxHourlyCapacity(snap.maxHourlyCapacity);
      setTakeReservationsAfterHours(snap.takeReservationsAfterHours);
    }
    setDineInModalOpen(false);
  }

  function saveDineInModal() {
    dineInMutation.mutate(
      {
        dinein_transfer_enabled: transferCallsDineIn,
        dinein_transfer_number: transferNumber || null,
        dinein_max_hourly_capacity: maxHourlyCapacity,
        dinein_take_reservations_after_hours: takeReservationsAfterHours,
      },
      {
        onSuccess: () => {
          setDineInModalOpen(false);
        },
      },
    );
  }

  React.useEffect(() => {
    if (!dineInModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelDineInModal();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dineInModalOpen]);

  function handleTakeawayToggle(val: boolean) {
    setTakeawayEnabled(val);
    takeawayMutation.mutate({
      takeaway_enabled: val,
      takeaway_stop_minutes_before_close: takeawayMinutes,
    });
  }

  function handleTakeawayChange(val: number) {
    setTakeawayMinutes(val);
    setTakeawayMinutesDraft(String(val));
    takeawayMutation.mutate({
      takeaway_enabled: takeawayEnabled,
      takeaway_stop_minutes_before_close: val,
    });
  }

  function syncTakeawayMinutesDraftToCommitted() {
    setTakeawayMinutesDraft(String(takeawayMinutes));
  }

  function onTakeawayMinutesInputChange(raw: string) {
    const v = raw.replace(/\D/g, '');
    setTakeawayMinutesDraft(v);
    const n = v === '' ? 0 : parseInt(v, 10);
    if (Number.isNaN(n)) return;
    const clamped = Math.max(0, n);
    if (clamped !== takeawayMinutes) {
      handleTakeawayChange(clamped);
    }
  }

  function handleDivertToggle(val: boolean) {
    setDivertEnabled(val);
    divertMutation.mutate({
      divert_enabled: val,
      divert_threshold_amount: divertThreshold,
    });
  }

  function handleDivertThresholdChange(val: number) {
    setDivertThreshold(val);
    divertMutation.mutate({
      divert_enabled: divertEnabled,
      divert_threshold_amount: val,
    });
  }

  function handleSmsToggle(val: boolean) {
    setSmsWhenReady(val);
    smsMutation.mutate({ sms_order_ready_enabled: val });
  }

  function handleAskCustomerNameToggle(val: boolean) {
    setAskCustomerName(val);
    customerNameMutation.mutate({ ask_customer_name: val });
  }

  function openBusinessHoursModal() {
    businessHoursSnapshotRef.current = JSON.parse(JSON.stringify(businessHours));
    setBusinessHoursOpen(true);
  }

  function cancelBusinessHours() {
    if (businessHoursSnapshotRef.current) {
      setBusinessHours(businessHoursSnapshotRef.current);
    }
    setBusinessHoursOpen(false);
  }

  function handleSaveBusinessHours() {
    const hours: DayHours[] = DAY_NAMES.map((name, i) => ({
      day_of_week: i,
      open_time: businessHours[name]?.from || null,
      close_time: businessHours[name]?.to || null,
    }));
    businessHoursMutation.mutate(hours);
    setBusinessHoursOpen(false);
  }

  const timeZones = React.useMemo(() => {
    const fallback = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Australia/Sydney',
    ];
    const supportedValuesOf = (Intl as any)?.supportedValuesOf;
    if (typeof supportedValuesOf === 'function') {
      try {
        const supported = supportedValuesOf('timeZone') as string[];
        const set = new Set<string>([...supported, ...fallback]);
        return Array.from(set).sort();
      } catch {
        // fallthrough
      }
    }
    return fallback;
  }, []);

  const filteredTimeZones = React.useMemo(() => {
    const q = tzQuery.trim().toLowerCase();
    if (!q) return timeZones;
    return timeZones.filter((z) => z.toLowerCase().includes(q));
  }, [timeZones, tzQuery]);

  const locationLabel = React.useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat(undefined, {
        timeZone: location,
        timeZoneName: 'short',
      }).formatToParts(now);
      const tzName = parts.find(
        (p) => p.type === 'timeZoneName',
      )?.value;
      return tzName ? `${location} (${tzName})` : location;
    } catch {
      return location;
    }
  }, [location, now]);

  const locationTimeLabel = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: location,
        hour: '2-digit',
        minute: '2-digit',
      }).format(now);
    } catch {
      return new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(now);
    }
  }, [location, now]);

  const businessHoursTimeInputClass = cn(
    'box-border min-h-11 w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container-low py-2.5 pl-3 pr-2 text-sm text-on-surface outline-none',
    'focus:border-primary/40 focus:ring-1 focus:ring-primary/40 disabled:opacity-50',
    'md:w-auto md:min-w-[10rem] md:max-w-[12rem]',
  );

  function renderBusinessHoursToggle(
    day: string,
    t: { from: string; to: string },
  ) {
    return (
      <Toggle
        checked={!!(t.from || t.to)}
        onChange={(next) => {
          if (!next) {
            setBusinessHours((prev) => ({
              ...prev,
              [day]: { from: '', to: '' },
            }));
            return;
          }
          setBusinessHours((prev) => ({
            ...prev,
            [day]: {
              from: prev[day]?.from || '09:00',
              to: prev[day]?.to || '22:00',
            },
          }));
        }}
        ariaLabel={`${day} open`}
      />
    );
  }

  return (
    <div className="min-h-0 flex-1">
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10 sm:px-6 sm:py-6 lg:p-8 lg:pb-12">
        <div className="mx-auto max-w-5xl">
          {settingsLoading ? (
            <SettingsPageSkeleton />
          ) : (
            <>
          <div className="mb-6">
            <h2 className="font-headline text-2xl font-extrabold text-on-surface">
              Settings
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Business Hours */}
            <section className="glass-panel p-8 rounded-xl flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold font-headline mb-1">
                    Business Hours
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Sync with your operating schedule.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openBusinessHoursModal}
                  className="px-4 py-2 bg-surface-bright text-on-surface text-xs font-semibold rounded-lg hover:bg-surface-container transition-colors"
                >
                  Edit Business Hours
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-lg">
                <div className="flex items-center gap-3">
                  <Mic className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Voice Agent Active</p>
                    <p className="text-xs text-on-surface-variant">
                      Allow AI to handle off-hour queries
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={voiceAgentActive}
                  onChange={handleAgentToggle}
                  ariaLabel="Toggle voice agent active"
                />
              </div>
            </section>

            {/* Dine-in */}
            <section className="glass-panel flex flex-col gap-6 rounded-xl p-8">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="mb-1 font-headline text-lg font-bold">
                    Dine-in
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Manage table reservations and capacity.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openDineInModal}
                  className="shrink-0 rounded-lg bg-surface-bright px-4 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
                >
                  Edit Dine-in settings
                </button>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={openDineInModal}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openDineInModal();
                }}
                className={cn(
                  'flex min-h-[4.5rem] cursor-pointer items-center gap-3 rounded-lg bg-surface-container-low p-4 transition-colors',
                  'hover:bg-surface-container focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-primary/10">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface">
                    Reservations & table flow
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">
                    Set transfer rules, hourly capacity, and reservation options
                    — use{' '}
                    <span className="font-semibold text-on-surface/90">
                      Edit Dine-in settings
                    </span>{' '}
                    to update.
                  </p>
                </div>
              </div>
            </section>

            {/* Takeaway */}
            <section className="glass-panel p-8 rounded-xl flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold font-headline mb-1">
                    Takeaway
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Optimize order pickup flow.
                  </p>
                </div>
                <Toggle
                  checked={takeawayEnabled}
                  onChange={handleTakeawayToggle}
                  ariaLabel="Toggle takeaway"
                />
              </div>
              <div
                className={[
                  'space-y-2 transition-opacity',
                  takeawayEnabled ? 'opacity-100' : 'opacity-40',
                ].join(' ')}
              >
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Stop takeaway before closing (minutes)
                </label>
                <div className="relative">
                  <input
                    className="sunken-input w-full h-11 pl-4 pr-28 rounded-lg text-sm font-semibold disabled:cursor-not-allowed appearance-none"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={takeawayMinutesDraft}
                    onChange={(e) =>
                      onTakeawayMinutesInputChange(e.target.value)
                    }
                    onBlur={syncTakeawayMinutesDraftToCommitted}
                    disabled={!takeawayEnabled}
                  />
                  <span className="absolute right-[84px] top-1/2 -translate-y-1/2 text-xs text-on-surface-variant/80 uppercase font-bold tracking-widest">
                    Minutes
                  </span>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!takeawayEnabled || takeawayMinutes <= 0}
                      onClick={() =>
                        handleTakeawayChange(
                          Math.max(0, takeawayMinutes - 1),
                        )
                      }
                      className="h-8 w-8 rounded-lg bg-surface-container-low hover:bg-surface-bright border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center disabled:opacity-30"
                      aria-label="Decrease takeaway minutes"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!takeawayEnabled}
                      onClick={() =>
                        handleTakeawayChange(takeawayMinutes + 1)
                      }
                      className="h-8 w-8 rounded-lg bg-surface-container-low hover:bg-surface-bright border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center disabled:opacity-30"
                      aria-label="Increase takeaway minutes"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-on-surface-variant mt-2 italic">
                  Prevent last-minute orders that extend staff shifts.
                </p>
              </div>
            </section>

            {/* Divert */}
            <section className="glass-panel p-8 rounded-xl flex flex-col gap-6">
              <div>
                <h3 className="text-lg font-bold font-headline mb-1">
                  Divert if Order Value Exceeds
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Route high-value orders to staff.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">
                    Divert if Order Value Exceeds $
                  </p>
                  <Toggle
                    checked={divertEnabled}
                    onChange={handleDivertToggle}
                    ariaLabel="Toggle divert if order value exceeds"
                  />
                </div>
                <div className="relative">
                  <input
                    className={[
                      'sunken-input w-full h-11 pl-4 pr-28 rounded-lg text-sm font-semibold disabled:cursor-not-allowed appearance-none transition-opacity',
                      divertEnabled ? 'opacity-100' : 'opacity-40',
                    ].join(' ')}
                    type="number"
                    value={divertThreshold === 0 ? '' : divertThreshold}
                    placeholder="0"
                    inputMode="decimal"
                    pattern="\\d*(\\.\\d*)?"
                    step="any"
                    onKeyDown={(e) => {
                      const blocked = ['-', '+', 'e', 'E'];
                      if (blocked.includes(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const cleaned = raw
                        .replace(/[^0-9.]/g, '')
                        .replace(/^([0-9]*\\.?)[\\s\\S]*$/, '$1');
                      const parts = cleaned.split('.');
                      const normalized =
                        parts.length <= 1
                          ? cleaned
                          : `${parts[0]}.${parts.slice(1).join('')}`;
                      const n =
                        normalized === '' ? 0 : Number.parseFloat(normalized);
                      if (Number.isNaN(n)) return;
                      handleDivertThresholdChange(Math.max(0, n));
                    }}
                    disabled={!divertEnabled}
                    min={0}
                  />
                  <span className="absolute right-[84px] top-1/2 -translate-y-1/2 text-xs text-on-surface-variant/80 uppercase font-bold tracking-widest">
                    USD
                  </span>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!divertEnabled || divertThreshold <= 0}
                      onClick={() =>
                        handleDivertThresholdChange(
                          Math.max(0, divertThreshold - 1),
                        )
                      }
                      className="h-8 w-8 rounded-lg bg-surface-container-low hover:bg-surface-bright border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center disabled:opacity-30"
                      aria-label="Decrease divert threshold"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!divertEnabled}
                      onClick={() =>
                        handleDivertThresholdChange(divertThreshold + 1)
                      }
                      className="h-8 w-8 rounded-lg bg-surface-container-low hover:bg-surface-bright border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors flex items-center justify-center disabled:opacity-30"
                      aria-label="Increase divert threshold"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* SMS */}
            <section className="glass-panel p-8 rounded-xl flex flex-col gap-6">
              <div>
                <h3 className="text-lg font-bold font-headline mb-1">
                  SMS Notifications
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Keep your customers in the loop.
                </p>
              </div>
              <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="text-sm font-semibold">
                      Send SMS when order is ready
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Automated text triggered by kitchen
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={smsWhenReady}
                  onChange={handleSmsToggle}
                  ariaLabel="Toggle SMS when order is ready"
                />
              </div>
            </section>

            {/* Ask customer name (frontend-only until API exists) */}
            <section className="glass-panel flex flex-col gap-6 rounded-xl p-6 sm:p-8">
              <div>
                <h3 className="mb-1 font-headline text-lg font-bold">
                  Customer name
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Control whether callers are prompted for their name during
                  orders.
                </p>
              </div>
              <div className="flex flex-col gap-4 rounded-lg border border-outline-variant/80 bg-surface-container-low/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-primary/10">
                    <UserRound className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface">
                      Ask customer name
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      When enabled, the flow can collect the caller&apos;s name
                      before completing an order.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 justify-end sm:pl-4">
                  <Toggle
                    checked={askCustomerName}
                    onChange={handleAskCustomerNameToggle}
                    ariaLabel="Toggle ask customer name"
                  />
                </div>
              </div>
            </section>

            {/* Region & Time */}
            <section className="glass-panel flex flex-col gap-4 rounded-xl p-6 sm:gap-5 sm:p-8">
              <div className="flex flex-row items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-primary/10 shadow-lg overflow-hidden">
                  <MapPin className="h-8 w-8 text-primary/50" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <h3 className="text-lg font-bold font-headline">
                    Region & Time
                  </h3>
                  <div className="relative self-start" ref={locationWrapRef}>
                      <button
                        type="button"
                        onClick={() => setLocationOpen((v) => !v)}
                        className={cn(
                          'glass-panel flex items-center justify-between gap-2 rounded-lg px-4 py-2 text-xs font-bold text-on-surface',
                          'hover:bg-surface-bright transition-all active:scale-95',
                          'whitespace-nowrap',
                        )}
                        aria-haspopup="listbox"
                        aria-expanded={locationOpen}
                      >
                        <span>Change Location</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 shrink-0 text-on-surface-variant/85 transition-transform',
                            locationOpen && 'rotate-180',
                          )}
                        />
                      </button>

                      {locationOpen && (
                        <>
                          {/* Mobile: centered fixed overlay */}
                          <div
                            className="fixed inset-0 z-[500] flex items-end justify-center px-4 pb-6 pt-[45vh] sm:hidden"
                            onClick={() => {
                              setLocationOpen(false);
                              setTzQuery('');
                            }}
                          >
                            <div
                              role="listbox"
                              className="flex max-h-[50vh] min-h-[16rem] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-outline-variant bg-white shadow-2xl"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="shrink-0 border-b border-outline-variant bg-surface-container p-3">
                                <input
                                  type="text"
                                  value={tzQuery}
                                  onChange={(e) => setTzQuery(e.target.value)}
                                  placeholder="Search..."
                                  className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                              </div>
                              <div className="flex-1 overflow-y-auto">
                                {filteredTimeZones.length === 0 ? (
                                  <div className="px-4 py-8 text-center">
                                    <p className="text-sm font-semibold text-on-surface">
                                      No results found
                                    </p>
                                    <p className="mt-1 text-xs text-on-surface-variant">
                                      Try a different search.
                                    </p>
                                  </div>
                                ) : (
                                  filteredTimeZones.map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      role="option"
                                      aria-selected={location === opt}
                                      onClick={() => {
                                        setLocation(opt);
                                        setLocationOpen(false);
                                        setTzQuery('');
                                        timezoneMutation.mutate(opt);
                                      }}
                                      className={cn(
                                        'w-full text-left px-4 py-3 text-sm font-semibold transition-colors',
                                        location === opt
                                          ? 'bg-primary/10 text-primary'
                                          : 'text-on-surface hover:bg-surface-container',
                                      )}
                                    >
                                      {opt}
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Desktop: absolute dropdown */}
                          <div
                            role="listbox"
                            className="absolute left-0 z-260 mt-2 hidden max-h-[min(18rem,70vh)] w-72 overflow-hidden rounded-xl border border-outline-variant bg-white/98 shadow-2xl backdrop-blur-2xl sm:block sm:left-auto sm:right-0"
                          >
                            <div className="border-b border-outline-variant bg-surface-container p-3">
                              <input
                                type="text"
                                value={tzQuery}
                                onChange={(e) => setTzQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                              />
                            </div>
                            <div className="max-h-56 overflow-y-auto">
                              {filteredTimeZones.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  role="option"
                                  aria-selected={location === opt}
                                  onClick={() => {
                                    setLocation(opt);
                                    setLocationOpen(false);
                                    setTzQuery('');
                                    timezoneMutation.mutate(opt);
                                  }}
                                  className={cn(
                                    'w-full text-left px-4 py-3 text-sm font-semibold transition-colors',
                                    location === opt
                                      ? 'bg-primary/10 text-primary'
                                      : 'text-on-surface hover:bg-surface-container',
                                  )}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                  </div>
                </div>
              </div>

              <div className="flex w-full min-w-0 items-start gap-2 text-on-surface-variant">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <p
                  className={cn(
                    'min-w-0 flex-1 text-sm leading-snug break-words',
                    'max-sm:whitespace-normal sm:truncate sm:whitespace-nowrap',
                  )}
                >
                  {locationLabel} — Currently {locationTimeLabel}
                </p>
              </div>
            </section>
          </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Business Hours Modal */}
      <AnimatePresence>
        {businessHoursOpen && (
          <div
            className="fixed inset-0 z-500 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-3 sm:p-4"
            onClick={cancelBusinessHours}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-surface-container-high rounded-xl shadow-2xl border border-outline-variant overflow-hidden max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-6 py-4 sm:px-8 sm:py-5">
                <h2 className="min-w-0 flex-1 text-left font-headline text-xl font-bold text-on-surface">
                  Edit Business Hours
                </h2>
                <button
                  type="button"
                  onClick={cancelBusinessHours}
                  className="shrink-0 text-on-surface-variant hover:text-primary transition-colors"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
                {/* Mobile: stacked rows, full-width time inputs */}
                <div className="divide-y divide-outline-variant overflow-hidden rounded-xl border border-outline-variant md:hidden">
                  {DAY_NAMES.map((day) => {
                    const t = businessHours[day] ?? {
                      from: '',
                      to: '',
                    };
                    const isOff = !t.from && !t.to;
                    return (
                      <div
                        key={day}
                        className="bg-surface-container-low/40 px-4 py-4 first:pt-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-on-surface">
                            {day}
                          </span>
                          {renderBusinessHoursToggle(day, t)}
                        </div>
                        {isOff ? (
                          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant/75">
                            Closed
                          </p>
                        ) : (
                          <div className="mt-4 space-y-4">
                            <div>
                              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                                Opens
                              </label>
                              <input
                                type="time"
                                value={t.from}
                                onChange={(e) =>
                                  setBusinessHours((prev) => ({
                                    ...prev,
                                    [day]: {
                                      ...prev[day],
                                      from: e.target.value,
                                    },
                                  }))
                                }
                                className={businessHoursTimeInputClass}
                                aria-label={`${day} from`}
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                                Closes
                              </label>
                              <input
                                type="time"
                                value={t.to}
                                onChange={(e) =>
                                  setBusinessHours((prev) => ({
                                    ...prev,
                                    [day]: {
                                      ...prev[day],
                                      to: e.target.value,
                                    },
                                  }))
                                }
                                className={businessHoursTimeInputClass}
                                aria-label={`${day} to`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* md+: bordered table */}
                <div className="hidden overflow-hidden rounded-xl border border-outline-variant md:block">
                  <div className="grid grid-cols-[minmax(0,1.15fr)_104px_minmax(0,2fr)] border-b-2 border-outline-variant bg-surface-container-low">
                    <div className="border-r border-outline-variant py-3.5 pl-4 pr-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Days
                    </div>
                    <div className="border-r border-outline-variant py-3.5 px-3 text-center text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Status
                    </div>
                    <div className="py-3.5 pl-4 pr-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                      Timings
                    </div>
                  </div>
                  <div>
                    {DAY_NAMES.map((day) => {
                      const t = businessHours[day] ?? {
                        from: '',
                        to: '',
                      };
                      const isOff = !t.from && !t.to;
                      return (
                        <div
                          key={day}
                          className="grid grid-cols-[minmax(0,1.15fr)_104px_minmax(0,2fr)] items-center border-b border-outline-variant last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-3 border-r border-outline-variant py-4 pl-4 pr-4 text-sm font-semibold text-on-surface">
                            <span>{day}</span>
                            <span
                              className={
                                isOff
                                  ? 'text-xs font-bold uppercase tracking-widest text-on-surface-variant/75'
                                  : 'sr-only'
                              }
                            >
                              Off
                            </span>
                          </div>
                          <div className="flex justify-center border-r border-outline-variant py-4 px-3">
                            {renderBusinessHoursToggle(day, t)}
                          </div>
                          <div className="py-4 pl-4 pr-4">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                              <input
                                type="time"
                                value={t.from}
                                onChange={(e) =>
                                  setBusinessHours((prev) => ({
                                    ...prev,
                                    [day]: {
                                      ...prev[day],
                                      from: e.target.value,
                                    },
                                  }))
                                }
                                disabled={isOff}
                                className={businessHoursTimeInputClass}
                                aria-label={`${day} from`}
                              />
                              <span className="shrink-0 text-sm font-semibold text-on-surface-variant/80">
                                to
                              </span>
                              <input
                                type="time"
                                value={t.to}
                                onChange={(e) =>
                                  setBusinessHours((prev) => ({
                                    ...prev,
                                    [day]: {
                                      ...prev[day],
                                      to: e.target.value,
                                    },
                                  }))
                                }
                                disabled={isOff}
                                className={businessHoursTimeInputClass}
                                aria-label={`${day} to`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface-container-highest px-6 py-4 sm:flex-row sm:justify-end sm:gap-4 sm:px-8 sm:py-5">
                <button
                  type="button"
                  onClick={cancelBusinessHours}
                  className="px-6 py-2 bg-surface-bright text-on-surface rounded-lg font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBusinessHours}
                  disabled={businessHoursMutation.isPending}
                  className="px-8 py-2 bg-linear-to-r from-primary to-primary-container text-white rounded-lg font-bold hover:scale-95 transition-transform shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {businessHoursMutation.isPending
                    ? 'Saving…'
                    : 'Save Hours'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Dine-in settings modal */}
      <AnimatePresence>
        {dineInModalOpen && (
          <div
            className="fixed inset-0 z-500 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-md sm:p-4"
            onClick={cancelDineInModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-outline-variant px-6 py-4 sm:py-5">
                <h2 className="min-w-0 flex-1 text-left font-headline text-xl font-bold text-on-surface">
                  Dine-in settings
                </h2>
                <button
                  type="button"
                  onClick={cancelDineInModal}
                  className="shrink-0 text-on-surface-variant transition-colors hover:text-primary"
                  aria-label="Close"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-on-surface">
                      Transfer calls on Dine in
                    </p>
                    <div className="flex shrink-0 justify-end sm:pl-4">
                      <Toggle
                        checked={transferCallsDineIn}
                        onChange={handleDineInTransferToggle}
                        ariaLabel="Toggle transfer calls on dine in"
                      />
                    </div>
                  </div>

                  {/* Capacity block fades when transfer calls is enabled */}
                  <div
                    className={cn(
                      'space-y-6 transition-opacity duration-200',
                      transferCallsDineIn ? 'opacity-40' : 'opacity-100',
                    )}
                  >
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                        Maximum Hourly Capacity
                      </label>
                      <div className="relative">
                        <input
                          className="sunken-input h-11 w-full appearance-none rounded-lg pl-4 pr-28 text-sm font-semibold disabled:cursor-not-allowed"
                          type="number"
                          value={
                            maxHourlyCapacity === 0 ? '' : maxHourlyCapacity
                          }
                          placeholder="0"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          step={1}
                          onKeyDown={(e) => {
                            const blocked = ['-', '+', 'e', 'E', '.'];
                            if (blocked.includes(e.key)) e.preventDefault();
                          }}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/\D/g, '');
                            const n = cleaned === '' ? 0 : parseInt(cleaned, 10);
                            if (Number.isNaN(n)) return;
                            handleDineInCapacityChange(Math.max(0, n));
                          }}
                          disabled={transferCallsDineIn}
                          min={0}
                        />
                        <span className="absolute right-[84px] top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-widest text-on-surface-variant/80">
                          Guests/hr
                        </span>
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                          <button
                            type="button"
                            disabled={
                              transferCallsDineIn || maxHourlyCapacity <= 0
                            }
                            onClick={() =>
                              handleDineInCapacityChange(
                                Math.max(0, maxHourlyCapacity - 1),
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-bright hover:text-on-surface disabled:opacity-30"
                            aria-label="Decrease maximum hourly capacity"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={transferCallsDineIn}
                            onClick={() =>
                              handleDineInCapacityChange(maxHourlyCapacity + 1)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-bright hover:text-on-surface disabled:opacity-30"
                            aria-label="Increase maximum hourly capacity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* After-hours toggle is independent (no fade) */}
                  <div className="border-t border-outline-variant pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-on-surface">
                          Take reservations after hours
                        </p>
                        <p className="mt-1 text-xs text-on-surface-variant">
                          Allow reservations when the restaurant is closed.
                        </p>
                      </div>
                      <div className="flex shrink-0 justify-end sm:pl-4">
                        <Toggle
                          checked={takeReservationsAfterHours}
                          onChange={handleTakeReservationsAfterHoursToggle}
                          ariaLabel="Toggle take reservations after hours"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-outline-variant bg-surface-container-highest px-6 py-4 sm:flex-row sm:justify-end sm:gap-4 sm:py-5">
                <button
                  type="button"
                  onClick={cancelDineInModal}
                  className="rounded-lg bg-surface-bright px-6 py-2 font-semibold text-on-surface transition-colors hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDineInModal}
                  disabled={dineInMutation.isPending}
                  className="rounded-lg bg-linear-to-r from-primary to-primary-container px-8 py-2 font-bold text-white shadow-lg shadow-primary/20 transition-transform hover:scale-95 disabled:opacity-50"
                >
                  {dineInMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
