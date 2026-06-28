export type PlayerLevel = "iniciacion" | "intermedio" | "avanzado";
export type MatchStatus = "open" | "full" | "cancelled";
export type Sex = "male" | "female" | "other";
export type DominantHand = "left" | "right";
export type MatchMode = "pair" | "individual";
export type MatchVisibility = "open" | "closed";

export interface Profile {
  id: string;
  full_name: string | null;
  level: PlayerLevel | null;
  zone: string | null;
  avatar_url: string | null;
  elo: number;
  height_cm: number | null;
  sex: Sex | null;
  dominant_hand: DominantHand | null;
  club: string | null;
  racket: string | null;
  apparel_brand: string | null;
  looking_for_partner: boolean;
  onboarding_completed: boolean;
  push_token: string | null;
  is_pro: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  is_coach: boolean;
  coach_status: CoachStatus;
  coach_bio: string | null;
  coach_hourly_rate: number | null;
  coach_years_experience: number | null;
  coach_specialties: string | null;
  coach_featured: boolean;
  created_at: string;
}

export type CoachStatus = "none" | "pending" | "approved" | "rejected";

export type CoachLeadStatus = "pending" | "contacted" | "closed";

export interface CoachLead {
  id: string;
  coach_id: string;
  requester_id: string;
  message: string;
  status: CoachLeadStatus;
  created_at: string;
}

export interface CoachLeadWithProfiles extends CoachLead {
  requester: Profile | null;
}

export interface Match {
  id: string;
  created_by: string;
  date_time: string;
  location: string;
  level: PlayerLevel;
  max_players: number;
  status: MatchStatus;
  mode: MatchMode;
  visibility: MatchVisibility;
  created_at: string;
}

export interface MatchPlayer {
  match_id: string;
  player_id: string;
  joined_at: string;
}

export interface MatchWithPlayers extends Match {
  match_players: (MatchPlayer & { profiles: Profile | null })[];
}

export type RequestStatus = "pending" | "accepted" | "rejected";

export interface PartnerRequest {
  id: string;
  from_id: string;
  to_id: string;
  status: RequestStatus;
  created_at: string;
}

export interface PartnerRequestWithProfiles extends PartnerRequest {
  from_profile: Profile | null;
  to_profile: Profile | null;
}

export interface Message {
  id: string;
  request_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export type Team = "a" | "b";

export type ResultStatus = "pending" | "confirmed" | "disputed";

export interface SetScore {
  a: number;
  b: number;
}

export interface MatchResult {
  id: string;
  match_id: string;
  team_a_player1: string;
  team_a_player2: string;
  team_b_player1: string;
  team_b_player2: string;
  sets: SetScore[];
  winner: Team;
  recorded_by: string;
  status: ResultStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  disputed_by: string | null;
  disputed_at: string | null;
  created_at: string;
}

export interface MatchResultWithProfiles extends MatchResult {
  team_a_player1_profile: Profile | null;
  team_a_player2_profile: Profile | null;
  team_b_player1_profile: Profile | null;
  team_b_player2_profile: Profile | null;
}

export type AchievementType =
  | "first_match"
  | "matches_5"
  | "matches_10"
  | "matches_25"
  | "first_win"
  | "wins_5"
  | "wins_10"
  | "wins_25"
  | "elo_1300"
  | "elo_1400"
  | "elo_1500";

export interface Achievement {
  id: string;
  profile_id: string;
  type: AchievementType;
  created_at: string;
}

export interface AchievementWithProfile extends Achievement {
  profiles: Profile | null;
}

export interface Follow {
  follower_id: string;
  followed_id: string;
  created_at: string;
}

export interface BlockedUser {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export type ReportTargetType = "profile" | "match" | "match_result";
export type ReportStatus = "open" | "reviewed" | "dismissed";

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
}

export type VibItemType = "achievement" | "match_result";

export interface Vib {
  id: string;
  profile_id: string;
  item_type: VibItemType;
  item_id: string;
  created_at: string;
}

export interface EloHistoryEntry {
  id: string;
  profile_id: string;
  match_result_id: string;
  delta: number;
  elo_after: number;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  created_by: string;
  invite_code: string;
  created_at: string;
}

export interface LeagueMember {
  league_id: string;
  profile_id: string;
  joined_at: string;
}

export interface LeagueMemberWithProfile extends LeagueMember {
  profiles: Profile | null;
}

export type TournamentFormat = "round_robin" | "bracket";
export type TournamentStatus = "draft" | "open" | "active" | "completed";

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
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
}

export interface TournamentParticipantWithProfiles extends TournamentParticipant {
  profile: Profile | null;
  partner: Profile | null;
}

export type TournamentMatchStatus = "pending" | "completed" | "bye";

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  entrant_a_id: string | null;
  entrant_b_id: string | null;
  sets: SetScore[] | null;
  winner_entrant_id: string | null;
  status: TournamentMatchStatus;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      matches: {
        Row: Match;
        Insert: Partial<Match> & {
          created_by: string;
          date_time: string;
          location: string;
          level: PlayerLevel;
        };
        Update: Partial<Match>;
      };
      match_players: {
        Row: MatchPlayer;
        Insert: Pick<MatchPlayer, "match_id" | "player_id">;
        Update: Partial<MatchPlayer>;
      };
    };
  };
}
