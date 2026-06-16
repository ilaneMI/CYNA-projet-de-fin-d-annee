/**
 * Supabase client stub.
 *
 * TODO: when Supabase integration lands, replace the mock with `createClient`
 * from `@supabase/supabase-js` and read `NEXT_PUBLIC_SUPABASE_URL` /
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `process.env`.
 *
 * Until then `SUPABASE_ENABLED` stays `false` and the app falls back to
 * `localStorage` (see `AuthContext`).
 */

export const SUPABASE_ENABLED = false;

type PostgrestError = { message: string };

type AuthResult<T = unknown> = { data: T | null; error: PostgrestError | null };

type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string };
};

type SignUpArgs = {
  email: string;
  password: string;
  options?: { data?: Record<string, unknown> };
};

type SignInArgs = { email: string; password: string };

type QueryResult = { data: unknown; error: PostgrestError | null };

type QueryBuilder = QueryResult & {
  select: () => QueryBuilder;
  insert: (values?: unknown) => QueryBuilder;
  update: (values?: unknown) => QueryBuilder;
  delete: () => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
};

const notConfigured = <T>(): AuthResult<T> => ({
  data: null,
  error: { message: 'Supabase not configured' },
});

const queryBuilder = (): QueryBuilder => {
  const builder = {
    data: null as unknown,
    error: null as PostgrestError | null,
  } as QueryBuilder;
  builder.select = () => builder;
  builder.insert = () => builder;
  builder.update = () => builder;
  builder.delete = () => builder;
  builder.eq = () => builder;
  return builder;
};

export const supabase = {
  auth: {
    signUp: async (_args: SignUpArgs): Promise<AuthResult<{ user: AuthUser | null }>> =>
      notConfigured<{ user: AuthUser | null }>(),
    signInWithPassword: async (
      _args: SignInArgs,
    ): Promise<AuthResult<{ user: AuthUser | null }>> => notConfigured<{ user: AuthUser | null }>(),
    signOut: async (): Promise<{ error: PostgrestError | null }> => ({ error: null }),
    resetPasswordForEmail: async (_email: string): Promise<AuthResult> => ({
      data: null,
      error: null,
    }),
    getSession: async (): Promise<{ data: { session: null }; error: PostgrestError | null }> => ({
      data: { session: null },
      error: null,
    }),
  },
  from: (_table: string): QueryBuilder => queryBuilder(),
};
