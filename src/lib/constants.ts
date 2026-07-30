import type { IncidentPriority, IncidentStatus, IncidentType, IncidentCategory } from './types';

export const CONFERENCE_NAME = 'HORIZONS 2026';
export const CONFERENCE_SUBTITLE = 'Incident Management';

export const PRIORITIES: IncidentPriority[] = ['critical', 'high', 'medium', 'low'];

export const STATUSES: IncidentStatus[] = ['open', 'in_progress', 'resolved'];

export const INCIDENT_TYPES: IncidentType[] = [
  'medical',
  'safety',
  'delegate',
  'technical',
  'venue',
  'materials',
  'security',
  'other',
];

export const LOCATIONS = [
  'Westminster 1',
  'Westminster 2',
  'Westminster 3',
  'Richmond A',
  'Richmond B',
  'Richmond C',
  'Richmond D',
  'Britannia B',
  'Britannia C',
  'Registration',
  'Secretariat Office',
  'Main Ballroom',
  'Hallway',
  'Other',
] as const;

export const PRIORITY_META: Record<
  IncidentPriority,
  { label: string; dot: string; text: string; bg: string; border: string; ring: string; rank: number }
> = {
  critical: {
    label: 'Critical',
    dot: 'bg-critical-500',
    text: 'text-critical-700',
    bg: 'bg-critical-50',
    border: 'border-critical-200',
    ring: 'ring-critical-500',
    rank: 0,
  },
  high: {
    label: 'High',
    dot: 'bg-high-500',
    text: 'text-high-700',
    bg: 'bg-high-50',
    border: 'border-high-200',
    ring: 'ring-high-500',
    rank: 1,
  },
  medium: {
    label: 'Medium',
    dot: 'bg-medium-500',
    text: 'text-medium-700',
    bg: 'bg-medium-50',
    border: 'border-medium-200',
    ring: 'ring-medium-500',
    rank: 2,
  },
  low: {
    label: 'Low',
    dot: 'bg-low-500',
    text: 'text-low-700',
    bg: 'bg-low-50',
    border: 'border-low-200',
    ring: 'ring-low-500',
    rank: 3,
  },
};

export const STATUS_META: Record<
  IncidentStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  open: {
    label: 'Open',
    dot: 'bg-critical-500',
    text: 'text-critical-700',
    bg: 'bg-critical-50',
    border: 'border-critical-200',
  },
  in_progress: {
    label: 'In Progress',
    dot: 'bg-high-500',
    text: 'text-high-700',
    bg: 'bg-high-50',
    border: 'border-high-200',
  },
  resolved: {
    label: 'Resolved',
    dot: 'bg-low-500',
    text: 'text-low-700',
    bg: 'bg-low-50',
    border: 'border-low-200',
  },
};

export const TYPE_META: Record<
  IncidentType,
  { label: string; icon: string }
> = {
  medical: { label: 'Medical', icon: '🏥' },
  safety: { label: 'Safety', icon: '🚨' },
  delegate: { label: 'Delegate', icon: '👤' },
  technical: { label: 'Technical / AV', icon: '🖥️' },
  venue: { label: 'Venue', icon: '🏨' },
  materials: { label: 'Materials', icon: '📦' },
  security: { label: 'Security / Access', icon: '🔑' },
  other: { label: 'Other', icon: '📢' },
};

// Fallback categories used before dynamic categories load from DB
export const DEFAULT_CATEGORIES: IncidentCategory[] = INCIDENT_TYPES.map((key, i) => ({
  id: key,
  key,
  label: TYPE_META[key].label,
  icon: TYPE_META[key].icon,
  active: true,
  sort_order: i + 1,
  created_at: new Date().toISOString(),
}));
