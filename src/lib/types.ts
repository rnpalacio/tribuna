export type Team = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  country: string | null;
  kind: "seleccion" | "club";
  competition_id: string | null;
  color: string | null;
  badge_url: string | null;
};

export type Player = {
  id: string;
  slug: string;
  name: string;
  position: string | null;
  country: string | null;
  team_id: string | null;
  photo_url: string | null;
};

export type Competition = {
  id: string;
  name: string;
  short_name: string | null;
  season: string | null;
  type: string | null;
  country?: string | null;
  slug?: string | null;
  color?: string | null;
  sort?: number | null;
  followable?: boolean | null;
};

export type Match = {
  id: string;
  competition_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "live" | "final" | "postponed";
  kickoff_at: string | null;
  venue: string | null;
  city: string | null;
  round: string | null;
  summary_url: string | null;
  tickets_url?: string | null;
  ticket_vendor?: string | null;
  home_team?: Team | null;
  away_team?: Team | null;
  competition?: Competition | null;
};

export type Standing = {
  id: string;
  competition_id: string;
  team_id: string;
  position: number | null;
  played: number;
  diff: number;
  points: number;
  team?: Team | null;
  competition?: Competition | null;
};

export type Source = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};

export type ArticleCategory = "chile" | "argentina" | "global";

export type Article = {
  id: string;
  source_id: string | null;
  category: ArticleCategory | null;
  title: string;
  summary: string | null;
  url: string | null;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  source?: Source | null;
};

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  team_id: string | null;
  player_id: string | null;
  votes: number;
  sort: number;
};

export type Poll = {
  id: string;
  kind: "prediction" | "poll";
  question: string;
  match_id: string | null;
  closes_at: string | null;
  active: boolean;
  total_votes: number;
  poll_options?: PollOption[];
};

export type Profile = {
  id: string;
  display_name: string | null;
  personalize_feed: boolean;
  analytics_opt_in: boolean;
  sponsors_opt_in: boolean;
  onboarded: boolean;
  predictor_points: number;
};
