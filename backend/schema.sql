-- ==========================================
-- WorkoutLLM Database Schema
-- ==========================================

-- Optional: enables UUID generation in PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- Participants
-- ==========================================

CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY,
    preferred_mode CHAR(1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT participants_preferred_mode_check
        CHECK (preferred_mode IN ('A', 'B', 'C', 'D'))
);

-- ==========================================
-- Messages
-- ==========================================

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    participant_id UUID,
    mode CHAR(1),
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content JSONB NOT NULL,

    CONSTRAINT messages_participant_id_fkey
        FOREIGN KEY (participant_id)
        REFERENCES participants(id)
        ON DELETE CASCADE,

    CONSTRAINT messages_mode_check
        CHECK (mode IN ('A', 'B', 'C', 'D'))
);

-- ==========================================
-- Mode Statistics
-- ==========================================

CREATE TABLE IF NOT EXISTS mode_stats (
    participant_id UUID NOT NULL,
    mode CHAR(1) NOT NULL,
    time_spent INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,

    PRIMARY KEY (participant_id, mode),

    CONSTRAINT mode_stats_participant_id_fkey
        FOREIGN KEY (participant_id)
        REFERENCES participants(id)
        ON DELETE CASCADE,

    CONSTRAINT mode_stats_mode_check
        CHECK (mode IN ('A', 'B', 'C', 'D'))
);