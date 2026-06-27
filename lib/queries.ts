import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { isEloProvisional } from "../constants/elo";
import type {
  AchievementWithProfile,
  CoachLead,
  CoachLeadWithProfiles,
  EloHistoryEntry,
  League,
  LeagueMemberWithProfile,
  ReportTargetType,
  Match,
  MatchResult,
  MatchResultWithProfiles,
  MatchWithPlayers,
  PartnerRequest,
  PartnerRequestWithProfiles,
  PlayerLevel,
  Profile,
  RequestStatus,
  SetScore,
  Team,
  VibItemType,
} from "../types/database";

export type FeedItem =
  | ({ kind: "achievement"; vibCount: number; vibbedByMe: boolean } & AchievementWithProfile)
  | ({ kind: "match_result"; vibCount: number; vibbedByMe: boolean } & MatchResultWithProfiles);

const LEVEL_ORDER: PlayerLevel[] = ["iniciacion", "intermedio", "avanzado"];

function compatibleLevels(level: PlayerLevel | null): PlayerLevel[] {
  if (!level) return LEVEL_ORDER;
  const index = LEVEL_ORDER.indexOf(level);
  return LEVEL_ORDER.filter((_, i) => Math.abs(i - index) <= 1);
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...changes }: Partial<Profile> & { id: string }) => {
      const { error } = await supabase.from("profiles").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["profile", variables.id] });
    },
  });
}

export type MatchDateRange = "today" | "week" | "weekend";

// Bounds are computed from "now" (not the start of today) so a filter never
// surfaces a match that has already kicked off.
export function getDateRangeBounds(range: MatchDateRange, now = new Date()): { from: Date; to: Date } {
  if (range === "today") {
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    return { from: now, to };
  }

  if (range === "week") {
    const to = new Date(now);
    to.setDate(to.getDate() + 7);
    return { from: now, to };
  }

  // weekend: through the end of the next (or current) Saturday/Sunday.
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  const daysUntilSaturday = day === 0 ? -1 : 6 - day;
  const saturday = new Date(now);
  saturday.setDate(saturday.getDate() + daysUntilSaturday);
  saturday.setHours(0, 0, 0, 0);
  const sunday = new Date(saturday);
  sunday.setDate(sunday.getDate() + 1);
  sunday.setHours(23, 59, 59, 999);
  return { from: now, to: sunday };
}

export function useMatches(filters: { zone?: string; level?: PlayerLevel; dateRange?: MatchDateRange }) {
  return useQuery({
    queryKey: ["matches", filters],
    queryFn: async () => {
      let query = supabase
        .from("matches")
        .select("*, match_players(*, profiles(*))")
        .eq("status", "open")
        .eq("visibility", "open")
        .order("date_time", { ascending: true });

      if (filters.zone) query = query.ilike("location", `%${filters.zone}%`);
      if (filters.level) query = query.eq("level", filters.level);
      if (filters.dateRange) {
        const { from, to } = getDateRangeBounds(filters.dateRange);
        query = query.gte("date_time", from.toISOString()).lte("date_time", to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as MatchWithPlayers[];
    },
  });
}

export function useMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, match_players(*, profiles(*))")
        .eq("id", matchId!)
        .single();
      if (error) throw error;
      return data as unknown as MatchWithPlayers;
    },
    enabled: !!matchId,
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      match: Pick<
        Match,
        "created_by" | "date_time" | "location" | "level" | "max_players" | "mode" | "visibility"
      > & { partnerId?: string }
    ) => {
      const { partnerId, ...matchFields } = match;
      const { data, error } = await supabase.from("matches").insert(matchFields).select().single();
      if (error) throw error;
      const created = data as Match;

      if (matchFields.mode === "pair" && partnerId) {
        const { error: joinError } = await supabase.from("match_players").insert([
          { match_id: created.id, player_id: matchFields.created_by },
          { match_id: created.id, player_id: partnerId },
        ]);
        if (joinError) throw joinError;
      }

      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function useJoinMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, playerId }: { matchId: string; playerId: string }) => {
      const { error } = await supabase
        .from("match_players")
        .insert({ match_id: matchId, player_id: playerId });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["match", variables.matchId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["myUpcomingMatches"] });
    },
  });
}

export function useLeaveMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, playerId }: { matchId: string; playerId: string }) => {
      const { error } = await supabase
        .from("match_players")
        .delete()
        .eq("match_id", matchId)
        .eq("player_id", playerId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["match", variables.matchId] });
      queryClient.invalidateQueries({ queryKey: ["matches"] });
      queryClient.invalidateQueries({ queryKey: ["myUpcomingMatches"] });
    },
  });
}

export function useCompatiblePlayers(currentUserId: string | undefined, profile: Profile | undefined) {
  return useQuery({
    queryKey: ["compatiblePlayers", currentUserId, profile?.level, profile?.zone],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").neq("id", currentUserId!);

      if (profile?.level) query = query.in("level", compatibleLevels(profile.level));
      if (profile?.zone) query = query.ilike("zone", `%${profile.zone}%`);

      const { data, error } = await query;
      if (error) throw error;

      const { data: blocks } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("blocker_id", currentUserId);
      const blockedIds = new Set((blocks ?? []).map((b) => b.blocked_id as string));

      return (data as Profile[]).filter((p) => !blockedIds.has(p.id));
    },
    enabled: !!currentUserId && !!profile,
  });
}

// ---- Safety: blocking, reporting, account deletion ----

export function useBlockedUsers(userId: string | undefined) {
  return useQuery({
    queryKey: ["blockedUsers", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userId);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.blocked_id as string));
    },
    enabled: !!userId,
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockerId, blockedId }: { blockerId: string; blockedId: string }) => {
      const { error } = await supabase.from("blocked_users").insert({ blocker_id: blockerId, blocked_id: blockedId });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
      queryClient.invalidateQueries({ queryKey: ["compatiblePlayers"] });
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockerId, blockedId }: { blockerId: string; blockedId: string }) => {
      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", blockerId)
        .eq("blocked_id", blockedId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blockedUsers"] });
      queryClient.invalidateQueries({ queryKey: ["compatiblePlayers"] });
    },
  });
}

export function useReportContent() {
  return useMutation({
    mutationFn: async ({
      reporterId,
      targetType,
      targetId,
      reason,
      details,
    }: {
      reporterId: string;
      targetType: ReportTargetType;
      targetId: string;
      reason: string;
      details?: string;
    }) => {
      const { error } = await supabase
        .from("reports")
        .insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason, details: details ?? null });
      if (error) throw error;
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
    },
  });
}

export function usePartnerRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ["partnerRequests", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_requests")
        .select("*, from_profile:profiles!partner_requests_from_id_fkey(*), to_profile:profiles!partner_requests_to_id_fkey(*)")
        .or(`from_id.eq.${userId},to_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PartnerRequestWithProfiles[];
    },
    enabled: !!userId,
  });
}

export function useSendPartnerRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: string; toId: string }) => {
      const { error } = await supabase
        .from("partner_requests")
        .insert({ from_id: fromId, to_id: toId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partnerRequests"] });
    },
  });
}

export function useRespondPartnerRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: RequestStatus }) => {
      const { error } = await supabase
        .from("partner_requests")
        .update({ status })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partnerRequests"] });
    },
  });
}

export function useHiddenChats(userId: string | undefined) {
  return useQuery({
    queryKey: ["hiddenChats", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chat_hides").select("request_id").eq("profile_id", userId);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.request_id as string));
    },
    enabled: !!userId,
  });
}

export function useHideChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, profileId }: { requestId: string; profileId: string }) => {
      const { error } = await supabase.from("chat_hides").insert({ request_id: requestId, profile_id: profileId });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hiddenChats"] });
    },
  });
}

const RESULT_PROFILES_SELECT =
  "*, team_a_player1_profile:profiles!match_results_team_a_player1_fkey(*), team_a_player2_profile:profiles!match_results_team_a_player2_fkey(*), team_b_player1_profile:profiles!match_results_team_b_player1_fkey(*), team_b_player2_profile:profiles!match_results_team_b_player2_fkey(*)";

function didWin(result: MatchResult, userId: string): boolean {
  const inTeamA = result.team_a_player1 === userId || result.team_a_player2 === userId;
  return (inTeamA && result.winner === "a") || (!inTeamA && result.winner === "b");
}

export function useMatchResult(matchId: string | undefined) {
  return useQuery({
    queryKey: ["matchResult", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_results")
        .select(RESULT_PROFILES_SELECT)
        .eq("match_id", matchId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as MatchResultWithProfiles | null;
    },
    enabled: !!matchId,
  });
}

export function useRecordMatchResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (result: {
      matchId: string;
      teamAPlayer1: string;
      teamAPlayer2: string;
      teamBPlayer1: string;
      teamBPlayer2: string;
      sets: SetScore[];
      winner: Team;
      recordedBy: string;
    }) => {
      const { error } = await supabase.from("match_results").insert({
        match_id: result.matchId,
        team_a_player1: result.teamAPlayer1,
        team_a_player2: result.teamAPlayer2,
        team_b_player1: result.teamBPlayer1,
        team_b_player2: result.teamBPlayer2,
        sets: result.sets,
        winner: result.winner,
        recorded_by: result.recordedBy,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["matchResult", variables.matchId] });
      queryClient.invalidateQueries({ queryKey: ["myStats"] });
      queryClient.invalidateQueries({ queryKey: ["recentResults"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

function useUpdateMatchResultStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { resultId: string; matchId: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("match_results").update(vars.patch).eq("id", vars.resultId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["matchResult", variables.matchId] });
      queryClient.invalidateQueries({ queryKey: ["myStats"] });
      queryClient.invalidateQueries({ queryKey: ["recentResults"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useConfirmMatchResult() {
  const update = useUpdateMatchResultStatus();
  return {
    ...update,
    mutate: (vars: { resultId: string; matchId: string; userId: string }, options?: Parameters<typeof update.mutate>[1]) =>
      update.mutate(
        { resultId: vars.resultId, matchId: vars.matchId, patch: { status: "confirmed", confirmed_by: vars.userId, confirmed_at: new Date().toISOString() } },
        options
      ),
  };
}

export function useDisputeMatchResult() {
  const update = useUpdateMatchResultStatus();
  return {
    ...update,
    mutate: (vars: { resultId: string; matchId: string; userId: string }, options?: Parameters<typeof update.mutate>[1]) =>
      update.mutate(
        { resultId: vars.resultId, matchId: vars.matchId, patch: { status: "disputed", disputed_by: vars.userId, disputed_at: new Date().toISOString() } },
        options
      ),
  };
}

export function useMyStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["myStats", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_results")
        .select("*")
        .eq("status", "confirmed")
        .or(
          `team_a_player1.eq.${userId},team_a_player2.eq.${userId},team_b_player1.eq.${userId},team_b_player2.eq.${userId}`
        );
      if (error) throw error;
      const results = (data as MatchResult[]) ?? [];
      const played = results.length;
      const won = results.filter((r) => didWin(r, userId!)).length;
      return {
        played,
        won,
        winRate: played > 0 ? Math.round((won / played) * 100) : 0,
        eloProvisional: isEloProvisional(played),
      };
    },
    enabled: !!userId,
  });
}

// Personal "PR" style highlights: longest win streak and busiest month are
// derived from confirmed match_results directly; best ELO gain comes from
// elo_history (0020), which only starts logging from when it was applied —
// so it's null until a player has at least one confirmed match since then.
export function usePersonalRecords(userId: string | undefined) {
  return useQuery({
    queryKey: ["personalRecords", userId],
    queryFn: async () => {
      const { data: resultsData, error: resultsError } = await supabase
        .from("match_results")
        .select("*")
        .eq("status", "confirmed")
        .or(
          `team_a_player1.eq.${userId},team_a_player2.eq.${userId},team_b_player1.eq.${userId},team_b_player2.eq.${userId}`
        )
        .order("created_at", { ascending: true });
      if (resultsError) throw resultsError;
      const results = (resultsData as MatchResult[]) ?? [];

      let longestWinStreak = 0;
      let currentStreak = 0;
      const countByMonth = new Map<string, number>();
      for (const result of results) {
        if (didWin(result, userId!)) {
          currentStreak += 1;
          longestWinStreak = Math.max(longestWinStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
        const month = result.created_at.slice(0, 7);
        countByMonth.set(month, (countByMonth.get(month) ?? 0) + 1);
      }

      let busiestMonth: { label: string; count: number } | null = null;
      for (const [month, count] of countByMonth) {
        if (!busiestMonth || count > busiestMonth.count) {
          const label = new Date(`${month}-01`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
          busiestMonth = { label, count };
        }
      }

      const { data: eloData, error: eloError } = await supabase
        .from("elo_history")
        .select("*")
        .eq("profile_id", userId!)
        .order("delta", { ascending: false })
        .limit(1);
      if (eloError) throw eloError;
      const bestEloEntry = ((eloData as EloHistoryEntry[]) ?? [])[0];
      const bestEloGain =
        bestEloEntry && bestEloEntry.delta > 0 ? { delta: bestEloEntry.delta, createdAt: bestEloEntry.created_at } : null;

      return { longestWinStreak, busiestMonth, bestEloGain };
    },
    enabled: !!userId,
  });
}

export function useRecentResults(userId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ["recentResults", userId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_results")
        .select(RESULT_PROFILES_SELECT)
        .or(
          `team_a_player1.eq.${userId},team_a_player2.eq.${userId},team_b_player1.eq.${userId},team_b_player2.eq.${userId}`
        )
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as unknown as MatchResultWithProfiles[];
    },
    enabled: !!userId,
  });
}

export function useMyUpcomingMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["myUpcomingMatches", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_players")
        .select("matches(*, match_players(*, profiles(*)))")
        .eq("player_id", userId!);
      if (error) throw error;
      
      const now = new Date();
      const upcoming = (data ?? [])
        .map((mp: any) => mp.matches)
        .filter((m: any) => m && m.status === "open" && new Date(m.date_time) > now)
        .sort((a: any, b: any) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
        
      return upcoming as unknown as MatchWithPlayers[];
    },
    enabled: !!userId,
  });
}

export function useLeaderboard(zone: string | null | undefined) {
  return useQuery({
    queryKey: ["leaderboard", zone],
    queryFn: async () => {
      let query = supabase.rpc("leaderboard_profiles").select("*").order("elo", { ascending: false }).limit(10);
      if (zone) query = query.ilike("zone", `%${zone}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as Profile[];
    },
  });
}

// Activity feed combining two sources scoped to players the current user
// follows (see 0009_follows.sql): system-generated achievement milestones
// (0008_achievements.sql) and confirmed match results (0018's pending/
// confirmed/disputed flow — only confirmed results are real activity, the
// same gate the leaderboard and achievements use). Not by zone — an empty
// following list means an empty feed.
export function useActivityFeed(userId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["activityFeed", userId, limit],
    queryFn: async () => {
      const { data: following, error: followError } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", userId);
      if (followError) throw followError;

      const followedIds = (following ?? []).map((f) => f.followed_id);
      if (followedIds.length === 0) return [] as FeedItem[];

      const resultsOrFilter = followedIds
        .map(
          (id) =>
            `team_a_player1.eq.${id},team_a_player2.eq.${id},team_b_player1.eq.${id},team_b_player2.eq.${id}`
        )
        .join(",");

      const [achievementsRes, resultsRes] = await Promise.all([
        supabase
          .from("achievements")
          .select("*, profiles(*)")
          .in("profile_id", followedIds)
          .order("created_at", { ascending: false })
          .limit(limit),
        supabase
          .from("match_results")
          .select(RESULT_PROFILES_SELECT)
          .eq("status", "confirmed")
          .or(resultsOrFilter)
          .order("created_at", { ascending: false })
          .limit(limit),
      ]);
      if (achievementsRes.error) throw achievementsRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const achievementItems = ((achievementsRes.data as unknown as AchievementWithProfile[]) ?? []).map(
        (a) => ({ ...a, kind: "achievement" as const, vibCount: 0, vibbedByMe: false })
      );
      const resultItems = ((resultsRes.data as unknown as MatchResultWithProfiles[]) ?? []).map((r) => ({
        ...r,
        kind: "match_result" as const,
        vibCount: 0,
        vibbedByMe: false,
      }));

      const merged: FeedItem[] = [...achievementItems, ...resultItems]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);

      if (merged.length === 0) return merged;

      const { data: vibs, error: vibsError } = await supabase
        .from("vibs")
        .select("item_id, item_type, profile_id")
        .in("item_id", merged.map((item) => item.id));
      if (vibsError) throw vibsError;

      return merged.map((item) => {
        const itemVibs = (vibs ?? []).filter((v) => v.item_id === item.id && v.item_type === item.kind);
        return { ...item, vibCount: itemVibs.length, vibbedByMe: itemVibs.some((v) => v.profile_id === userId) };
      });
    },
    enabled: !!userId,
  });
}

// Give or remove a Vib (kudos-equivalent) on a feed item. Polymorphic over
// item_type so the same mutation works for achievements and match results —
// see 0019_vibs_and_feed.sql.
export function useToggleVib() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { profileId: string; itemType: VibItemType; itemId: string; currentlyVibbed: boolean }) => {
      if (vars.currentlyVibbed) {
        const { error } = await supabase
          .from("vibs")
          .delete()
          .eq("profile_id", vars.profileId)
          .eq("item_type", vars.itemType)
          .eq("item_id", vars.itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vibs")
          .insert({ profile_id: vars.profileId, item_type: vars.itemType, item_id: vars.itemId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
    },
  });
}

// Cheap counts for profile/player screens — no schema needed, just a head-only count.
export function useFollowerCount(profileId: string | undefined) {
  return useQuery({
    queryKey: ["followerCount", profileId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("followed_id", profileId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!profileId,
  });
}

export function useFollowingCount(profileId: string | undefined) {
  return useQuery({
    queryKey: ["followingCount", profileId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!profileId,
  });
}

// Full profiles of who follows the given user — mirrors useFollowedProfiles()
// but joins the other direction, for a "Followers" list.
export function useFollowers(userId: string | undefined) {
  return useQuery({
    queryKey: ["followers", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("profiles!follows_follower_id_fkey(*)")
        .eq("followed_id", userId!);
      if (error) throw error;
      return (data ?? []).map((f: any) => f.profiles as Profile);
    },
    enabled: !!userId,
  });
}

// Mini-leaderboard scoped to people the current user follows (plus themself).
// No 5-confirmed-match eligibility gate like the public leaderboard — this is
// a friends view, not a public ranking, so provisional players stay visible.
export function useFollowedLeaderboard(userId: string | undefined) {
  return useQuery({
    queryKey: ["followedLeaderboard", userId],
    queryFn: async () => {
      const { data: following, error: followError } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", userId);
      if (followError) throw followError;

      const ids = [...(following ?? []).map((f) => f.followed_id), userId];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids)
        .order("elo", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!userId,
  });
}

// Set of profile ids the current user follows — cheap to spread across any
// screen that needs to render a Follow/Following button state.
export function useFollowing(userId: string | undefined) {
  return useQuery({
    queryKey: ["following", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("follows").select("followed_id").eq("follower_id", userId);
      if (error) throw error;
      return new Set((data ?? []).map((f) => f.followed_id as string));
    },
    enabled: !!userId,
  });
}

// Full profiles of who the current user follows — for a "Following" list/tab,
// as opposed to useFollowing()'s id-only Set used for button state.
export function useFollowedProfiles(userId: string | undefined) {
  return useQuery({
    queryKey: ["followedProfiles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("profiles!follows_followed_id_fkey(*)")
        .eq("follower_id", userId);
      if (error) throw error;
      return (data ?? []).map((f: any) => f.profiles as Profile);
    },
    enabled: !!userId,
  });
}

export function useBlockedProfiles(userId: string | undefined) {
  return useQuery({
    queryKey: ["blockedProfiles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("profiles!blocked_users_blocked_id_fkey(*)")
        .eq("blocker_id", userId);
      if (error) throw error;
      return (data ?? []).map((b: any) => b.profiles as Profile);
    },
    enabled: !!userId,
  });
}

export function useFollowPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ followerId, followedId }: { followerId: string; followedId: string }) => {
      const { error } = await supabase.from("follows").insert({ follower_id: followerId, followed_id: followedId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["following"] });
      queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
    },
  });
}

export function useUnfollowPlayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ followerId, followedId }: { followerId: string; followedId: string }) => {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("followed_id", followedId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["following"] });
      queryClient.invalidateQueries({ queryKey: ["activityFeed"] });
    },
  });
}

export function useMyAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: ["myAchievements", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AchievementWithProfile[];
    },
    enabled: !!userId,
  });
}

// ---- Private leagues ----

export function useMyLeagues(userId: string | undefined) {
  return useQuery({
    queryKey: ["myLeagues", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_members")
        .select("leagues(*)")
        .eq("profile_id", userId);
      if (error) throw error;
      return (data ?? []).map((row: any) => row.leagues as League);
    },
    enabled: !!userId,
  });
}

export function useLeagueMembers(leagueId: string | undefined) {
  return useQuery({
    queryKey: ["leagueMembers", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_members")
        .select("*, profiles(*)")
        .eq("league_id", leagueId);
      if (error) throw error;
      const rows = data as unknown as LeagueMemberWithProfile[];
      return rows
        .filter((r) => r.profiles)
        .sort((a, b) => (b.profiles!.elo ?? 1200) - (a.profiles!.elo ?? 1200));
    },
    enabled: !!leagueId,
  });
}

export function useLeague(leagueId: string | undefined) {
  return useQuery({
    queryKey: ["league", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leagues").select("*").eq("id", leagueId!).single();
      if (error) throw error;
      return data as League;
    },
    enabled: !!leagueId,
  });
}

export function useCreateLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, createdBy }: { name: string; createdBy: string }) => {
      const { data, error } = await supabase
        .from("leagues")
        .insert({ name, created_by: createdBy })
        .select()
        .single();
      if (error) throw error;
      return data as League;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myLeagues"] });
    },
  });
}

export function useJoinLeagueByCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inviteCode, profileId }: { inviteCode: string; profileId: string }) => {
      const { data: league, error: findError } = await supabase
        .from("leagues")
        .select("*")
        .eq("invite_code", inviteCode.toUpperCase().trim())
        .single();
      if (findError || !league) throw new Error("No league found with that code.");
      const { error } = await supabase
        .from("league_members")
        .insert({ league_id: league.id, profile_id: profileId });
      if (error && error.code !== "23505") throw error;
      return league as League;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myLeagues"] });
      queryClient.invalidateQueries({ queryKey: ["leagueMembers"] });
    },
  });
}

export function useLeaveLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leagueId, profileId }: { leagueId: string; profileId: string }) => {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", leagueId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myLeagues"] });
      queryClient.invalidateQueries({ queryKey: ["leagueMembers"] });
    },
  });
}

export function useRemoveLeagueMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leagueId, profileId }: { leagueId: string; profileId: string }) => {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", leagueId)
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leagueMembers"] });
    },
  });
}

export function useDeleteLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leagueId: string) => {
      const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myLeagues"] });
    },
  });
}

// ---- Coach marketplace ----

export function useCoaches(zone?: string | null) {
  return useQuery({
    queryKey: ["coaches", zone],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").eq("coach_status", "approved");
      if (zone) query = query.ilike("zone", zone);
      const { data, error } = await query.order("coach_featured", { ascending: false }).order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });
}

export function useApplyToCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      bio,
      hourlyRate,
      yearsExperience,
      specialties,
    }: {
      id: string;
      bio: string;
      hourlyRate: number | null;
      yearsExperience: number | null;
      specialties: string;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          coach_status: "pending",
          coach_bio: bio,
          coach_hourly_rate: hourlyRate,
          coach_years_experience: yearsExperience,
          coach_specialties: specialties,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["profile", id] });
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
  });
}

export function useStopCoaching() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ coach_status: "none" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["profile", id] });
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
  });
}

export function useSendCoachLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ coachId, requesterId, message }: { coachId: string; requesterId: string; message: string }) => {
      const { error } = await supabase.from("coach_leads").insert({ coach_id: coachId, requester_id: requesterId, message });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coachLeads"] });
    },
  });
}

export function useMyCoachLeads(coachId: string | undefined) {
  return useQuery({
    queryKey: ["coachLeads", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_leads")
        .select("*, requester:profiles!coach_leads_requester_id_fkey(*)")
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CoachLeadWithProfiles[];
    },
    enabled: !!coachId,
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: CoachLead["status"] }) => {
      const { error } = await supabase.from("coach_leads").update({ status }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coachLeads"] });
    },
  });
}
