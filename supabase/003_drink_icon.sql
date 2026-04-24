-- Add icon column to drink_log so per-entry emoji choices sync across devices.
-- Run this in the Supabase SQL editor after 001_initial.sql.
ALTER TABLE drink_log ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT NULL;
