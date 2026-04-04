export const authService = {
  async signIn(email: string, password: string) {
    const supabase = useSupabaseClient()
    return await supabase.auth.signInWithPassword({ email, password })
  },
  async signOut() {
    const supabase = useSupabaseClient()
    return await supabase.auth.signOut()
  },
  async loadMyProfile() {
    const supabase = useSupabaseClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return null
    const { data } = await supabase.from('profiles').select('id, full_name, role').eq('id', userData.user.id).single()
    return data
  }
}
