import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Validate URL format before creating client
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
  console.error('Required variables: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Check if URL is valid
try {
  new URL(supabaseUrl);
} catch (error) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
  console.error('Expected format: https://your-project-id.supabase.co');
  console.error('Please update your .env file with a valid Supabase URL');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test connection
supabase.from('disasters').select('count').then(({ error }) => {
  if (error) {
    console.error('Supabase connection error:', error);
  } else {
    console.log('Supabase connected successfully');
  }
});