import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://lppgwmkkvxwyskkcvsib.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwcGd3bWtrdnh3eXNra2N2c2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjczMTgsImV4cCI6MjA3NzE0MzMxOH0.MxP-iE4M9q4JSXUosWxeo3ZsLm-blQOCMpYp8OpA_5c'
)
