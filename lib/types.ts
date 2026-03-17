export type TombLevel = 'national' | 'provincial' | 'city' | 'county' | 'external';

export type TombSource = {
  title: string;
  year?: number;
  url?: string;
  note?: string;
};

export type Tomb = {
  id: string;
  name: string;
  person?: string;
  aliases?: string[];
  level: TombLevel;
  category: string;
  era?: string;
  province?: string;
  city?: string;
  county?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  image_urls?: string[];
  source?: TombSource;
};

export type TombDetail = Tomb & {
  description?: string;
  reference?: {
    title: string;
    url: string;
    source: string;
  };
  images?: Array<{
    url: string;
    source: string;
  }>;
  favorited?: boolean;
  liked?: boolean;
  checkedIn?: boolean;
  stats: {
    likes: number;
    checkins: number;
    comments: number;
  };
  commentList: Array<{
    id: string;
    content: string;
    createdAt: string;
    userLabel: string;
    canDelete?: boolean;
  }>;
};

export type UserProfile = {
  id: string;
  email?: string | null;
  isGuest: boolean;
  label: string;
  avatarUrl?: string | null;
  gender?: 'unknown' | 'male' | 'female' | null;
  age?: number | null;
};
