-- Supabase schema migration for guest mode & freemium tiers
-- Run this in Supabase Dashboard → SQL Editor

-- Add trips_data column (stores array of Trip objects per user)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trips_data JSONB DEFAULT '[]'::jsonb;

-- Add wardrobe_items column (stores user-added wardrobe items for non-owner accounts)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS wardrobe_items JSONB DEFAULT '[]'::jsonb;

-- outfits_data column already exists.
-- Its format is extended in-app from flat { [dayId]: outfit }
-- to trip-keyed { [tripId]: { [dayId]: outfit } }
-- Migration happens automatically on first load in useOutfits.js.

-- capsule_ids already exists — no change needed.
