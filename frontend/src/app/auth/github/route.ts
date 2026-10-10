import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { shouldReconnectGitHub, githubOAuthScopes } from '@/utils/githubImport'

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const supabase = await createClient()

  // Check if session already exists
  const { data: { user } } = await supabase.auth.getUser()
  if (!shouldReconnectGitHub(Boolean(user), searchParams.get('reconnect'))) {
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Start oauth flow and redirect to the Supabase sign in url
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/auth/callback`,
      scopes: githubOAuthScopes(searchParams.get('reconnect')),
      queryParams: {
        prompt: 'select_account'
      }
    },
  })

  if (error) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  if (data.url) {
    return NextResponse.redirect(data.url)
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}
