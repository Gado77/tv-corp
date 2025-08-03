// src/shared/js/supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://bglzkdcmpakmspjumdrt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbHprZGNtcGFrbXNwanVtZHJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMDMyOTUsImV4cCI6MjA2OTY3OTI5NX0.FTEw06ou3xPr8m90y-Lomy43anNKA7HeTdEdImogSdw';

export const supabase = createClient(supabaseUrl, supabaseKey);