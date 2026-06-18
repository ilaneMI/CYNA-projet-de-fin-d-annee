import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Server-side admin gate for /admin/*.
 *
 * Three-layer protection model:
 *   1. THIS middleware — authoritative server gate. Bounces unauthenticated
 *      and non-admin requests BEFORE Next renders the /admin route, so the
 *      back-office HTML body never leaves the server. Also enforces AAL2
 *      (password + verified TOTP for the current session) per the policy
 *      that admins MUST use 2FA. The TOTP enrollment UI lives at
 *      `/my-account#two-factor` and the step-up form at `/admin/verify`;
 *      both remain reachable without AAL2 to avoid a lockout loop.
 *   2. Client-side `isAdmin()` in `src/features/admin/guard.ts` — UX only;
 *      hides the admin link in the header and prevents a flash of admin UI
 *      while the SPA settles. Easily bypassed by a determined attacker.
 *   3. Postgres RLS via `public.is_admin()` (see `modele-donnees-CYNA.md`
 *      §4) — ultimate defence. Even if both gates were bypassed, every
 *      read/write on admin-touched tables is checked row-by-row and
 *      rejected for non-admins.
 *
 * We read `public.profiles` with the user's own anon-key session, NOT with
 * the service_role. The `profiles_self_or_admin_read` RLS policy lets a
 * user select their own row — exactly what we need to know their role.
 * Putting the service_role anywhere near a request-scoped client would
 * defeat the whole RLS model.
 *
 * Future hardening (Admin CRUD lot, NOT this commit): thread the JWT `aal`
 * claim into RLS policies on admin-writable tables (products, orders,
 * audit log) so even a leaked cookie can perform no admin write without
 * AAL2 on the same session.
 */

const LOGIN_PATH = '/login';
const FORBIDDEN_REDIRECT = '/';
const STEP_UP_PATH = '/admin/verify';
const MFA_ENROLL_PATH = '/my-account';

export async function middleware(request: NextRequest) {
  // Mutable response reference so cookie refreshes from supabase.auth.getUser()
  // (rotating access tokens) propagate back to the browser. Rebuilding the
  // response inside setAll is the documented @supabase/ssr middleware pattern.
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail closed: with no Supabase configured we cannot verify the gate,
    // so treat the request as unauthenticated. Better a redirect loop than
    // a wide-open back-office.
    return redirectToLogin(request);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() round-trips to the Supabase Auth server and validates the JWT
  // signature + expiry, so a tampered cookie cannot fake a session.
  // getSession() reads the cookie locally and is unsafe inside a security
  // gate — never use it here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return forwardCookies(redirectToLogin(request), response);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin' || profile.is_active !== true) {
    const url = request.nextUrl.clone();
    url.pathname = FORBIDDEN_REDIRECT;
    url.search = '';
    return forwardCookies(NextResponse.redirect(url, 307), response);
  }

  // /admin/verify is the step-up page itself — letting the AAL check fire
  // on it would redirect to itself in a loop. The user is already proven
  // to be an active admin at this point, so it is safe to pass through.
  if (request.nextUrl.pathname === STEP_UP_PATH) {
    return response;
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  // Full admin: password + TOTP verified for this session.
  if (aal?.currentLevel === 'aal2') {
    return response;
  }

  // Admin holds a verified factor but this session is still AAL1 — send
  // them through /admin/verify to step up, preserving the original target.
  if (aal?.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
    const url = request.nextUrl.clone();
    url.pathname = STEP_UP_PATH;
    url.search = '';
    url.searchParams.set('from', request.nextUrl.pathname);
    return forwardCookies(NextResponse.redirect(url, 307), response);
  }

  // No verified factor: admins must enroll. Send to /my-account with a
  // reason hint so the page surfaces an inline alert and scrolls to the
  // 2FA section.
  const enrollUrl = request.nextUrl.clone();
  enrollUrl.pathname = MFA_ENROLL_PATH;
  enrollUrl.search = '';
  enrollUrl.hash = '';
  enrollUrl.searchParams.set('reason', 'mfa_required');
  return forwardCookies(NextResponse.redirect(enrollUrl, 307), response);
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = LOGIN_PATH;
  url.search = '';
  url.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(url, 307);
}

function forwardCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

// Strict matcher: ONLY /admin and /admin/* run through this middleware.
// Other routes (/, /catalogue, /login, /my-account…) are not intercepted,
// so neither latency nor cookie-refresh side effects leak onto them.
export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
