call npx vercel env add VITE_SUPABASE_URL production --value "https://ccjktzvfomiwlnshyjde.supabase.co" --yes
call npx vercel env add VITE_SUPABASE_ANON_KEY production --value "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjamt0enZmb21pd2xuc2h5amRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDc2MjYsImV4cCI6MjA5MjU4MzYyNn0.O1LZ1o4UqdKHKujEbgwc3JF9Nl3ESFEYyhJOJXMeGgk" --yes
call npx vercel env add PAYOS_CLIENT_ID production --value "aff36494-db04-4b65-aa8b-16e9c23b37e9" --yes
call npx vercel env add PAYOS_API_KEY production --value "670a5a9c-8fcf-46fa-8639-025010c41a2c" --yes
call npx vercel env add PAYOS_CHECKSUM_KEY production --value "d512b0ed4b1357eff3351d2284c532278303ff483fc8531e0bfd77087afed8f8" --yes
call npx vercel --prod --yes
