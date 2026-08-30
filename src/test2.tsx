import { supabase } from "./integrations/supabase/client";
type T = typeof supabase;
type U = ReturnType<T["from"]>;
