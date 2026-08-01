export type UserRole = 'admin' | 'staff';

export type IncidentPriority = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus = 'open' | 'in_progress' | 'resolved';

export type IncidentType =
  | 'medical'
  | 'safety'
  | 'delegate'
  | 'technical'
  | 'venue'
  | 'materials'
  | 'security'
  | 'other';

export interface Profile {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: UserRole;
  title: string | null;
  active: boolean;
  created_at: string;
}

export interface Incident {
  id: string;
  incident_number: string | null;
  type: IncidentType;
  priority: IncidentPriority;
  title: string;
  location: string;
  description: string;
  reporter_id: string;
  assigned_to: string | null;
  status: IncidentStatus;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  // joined fields
  reporter?: Profile | null;
  assignee?: Profile | null;
  acknowledger?: Profile | null;
  resolver?: Profile | null;
  claimer?: Profile | null;
  // lightweight notes joined for list view (search + CSV export)
  incident_notes?: { id: string; note: string }[];
}

export interface IncidentNote {
  id: string;
  incident_id: string;
  author_id: string;
  note: string;
  created_at: string;
  author?: Profile | null;
}

export interface IncidentHistory {
  id: string;
  incident_id: string;
  user_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  timestamp: string;
  user?: Profile | null;
}

export interface IncidentWithRelations extends Incident {
  incident_notes?: IncidentNote[];
}

export interface IncidentCategory {
  id: string;
  key: string;
  label: string;
  icon: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface IncidentMessage {
  id: string;
  incident_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  sender?: Profile | null;
}
