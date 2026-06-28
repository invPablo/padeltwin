export interface Profile {
  id: string;
  full_name: string | null;
  zone: string | null;
  elo: number;
  is_pro: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  coach_status: 'none' | 'pending' | 'approved' | 'rejected';
  coach_bio: string | null;
  coach_hourly_rate: number | null;
  coach_years_experience: number | null;
  coach_specialties: string | null;
  created_at: string;
}

export interface AdminReport {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  target_type: 'profile' | 'match' | 'match_result';
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
}

export interface AdminAchievement {
  id: string;
  profile_id: string;
  full_name: string | null;
  type: string;
  created_at: string;
}

export interface AdminMessage {
  id: string;
  request_id: string;
  sender_id: string;
  sender_name: string | null;
  body: string;
  created_at: string;
}

export type TournamentFormat = 'round_robin' | 'bracket';
export type TournamentStatusValue = 'draft' | 'open' | 'active' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatusValue;
  zone: string | null;
  starts_at: string | null;
  created_by: string;
  created_at: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  profile_id: string;
  partner_id: string | null;
  seed: number | null;
  created_at: string;
  profile: Profile | null;
  partner: Profile | null;
}

export interface SetScore {
  a: number;
  b: number;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  entrant_a_id: string | null;
  entrant_b_id: string | null;
  sets: SetScore[] | null;
  winner_entrant_id: string | null;
  status: 'pending' | 'completed' | 'bye';
  created_at: string;
}

export interface AdminDashboardStats {
  total_players: number;
  total_confirmed_matches: number;
  average_elo: number;
  signups_last_7_days: number;
  pending_coach_applications: number;
  open_reports: number;
  active_tournaments: number;
}

export interface AdminCollusionCandidate {
  profile_id: string;
  full_name: string | null;
  total_matches: number;
  distinct_opponents: number;
  top_opponent_id: string;
  top_opponent_name: string | null;
  top_opponent_matches: number;
  repeat_ratio: number;
  elo_gain_last_10: number;
}

export interface AdminLeague {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  creator_name: string | null;
  member_count: number;
  created_at: string;
}

export interface AdminLeagueMember {
  profile_id: string;
  full_name: string | null;
  elo: number;
  joined_at: string;
}
