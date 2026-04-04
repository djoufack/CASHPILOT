const fs=require("fs"),B=String.fromCharCode(96),D=String.fromCharCode(36),N=String.fromCharCode(10),Q=String.fromCharCode(39);
const url=(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||"").trim();
const anonKey=(process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY||"").trim();
