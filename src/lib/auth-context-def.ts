import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "@/types";

export type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};
