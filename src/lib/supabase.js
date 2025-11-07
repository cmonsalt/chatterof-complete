import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://lppgwmkkvxwyskkcvsib.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocWR4c2l4Y2RiZGx0aWp4bnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NjA1NTYsImV4cCI6MjA1MTUzNjU1Nn0.gqKcN_bHDQKXwwEGKsRDtQ2kpDKO7rUgTXQgvnxq1Yc'
)
