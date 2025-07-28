-- SoundMate AR Database Schema
-- Migration 001: Create all tables

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spotify_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    email VARCHAR(255),
    profile_image_url TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立 Users 索引
CREATE INDEX IF NOT EXISTS idx_users_spotify_id ON users(spotify_id);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Tracks Table
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spotify_track_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    artist VARCHAR(500) NOT NULL,
    album VARCHAR(500),
    duration_ms INTEGER,
    preview_url TEXT,
    image_url TEXT,
    external_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立 Tracks 索引
CREATE INDEX IF NOT EXISTS idx_tracks_spotify_id ON tracks(spotify_track_id);
CREATE INDEX IF NOT EXISTS idx_tracks_name ON tracks(name);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);

-- User Playback Records
CREATE TABLE IF NOT EXISTS user_playback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    hex_id VARCHAR(20) NOT NULL, -- H3 hex string
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    played_at TIMESTAMP NOT NULL,
    progress_ms INTEGER,
    is_playing BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立 User_Playback 索引
CREATE INDEX IF NOT EXISTS idx_playback_hex_time ON user_playback(hex_id, played_at);
CREATE INDEX IF NOT EXISTS idx_playback_user_time ON user_playback(user_id, played_at);
CREATE INDEX IF NOT EXISTS idx_playback_location ON user_playback(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_playback_track ON user_playback(track_id);

-- Hex Properties (聚合資料)
CREATE TABLE IF NOT EXISTS hex_properties (
    hex_id VARCHAR(20) PRIMARY KEY,
    center_lat DECIMAL(10, 8) NOT NULL,
    center_lng DECIMAL(11, 8) NOT NULL,
    resolution INTEGER NOT NULL, -- H3 resolution level
    total_plays INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    unique_tracks INTEGER DEFAULT 0,
    last_activity_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立 Hex_Properties 索引
CREATE INDEX IF NOT EXISTS idx_hex_location ON hex_properties(center_lat, center_lng);
CREATE INDEX IF NOT EXISTS idx_hex_activity ON hex_properties(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_hex_resolution ON hex_properties(resolution);

-- Hex Top Tracks (每個 Hex 的熱門歌曲)
CREATE TABLE IF NOT EXISTS hex_top_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hex_id VARCHAR(20) REFERENCES hex_properties(hex_id) ON DELETE CASCADE,
    track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
    play_count INTEGER DEFAULT 1,
    unique_users INTEGER DEFAULT 1,
    last_played_at TIMESTAMP NOT NULL,
    rank_score DECIMAL(10, 4) DEFAULT 0, -- 排名分數
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(hex_id, track_id)
);

-- 建立 Hex_Top_Tracks 索引
CREATE INDEX IF NOT EXISTS idx_hex_top_tracks_hex_rank ON hex_top_tracks(hex_id, rank_score DESC);
CREATE INDEX IF NOT EXISTS idx_hex_top_tracks_last_played ON hex_top_tracks(last_played_at);
CREATE INDEX IF NOT EXISTS idx_hex_top_tracks_play_count ON hex_top_tracks(play_count DESC);

-- User Sessions (追蹤用戶活動)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    last_hex_id VARCHAR(20),
    total_tracks_played INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立 User_Sessions 索引
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON user_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_sessions_hex ON user_sessions(last_hex_id);

-- 更新 updated_at 的觸發器函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 為需要的表格建立觸發器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hex_properties_updated_at BEFORE UPDATE ON hex_properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hex_top_tracks_updated_at BEFORE UPDATE ON hex_top_tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 創建一些有用的視圖

-- 熱門歌曲視圖 (結合 track 資訊)
CREATE OR REPLACE VIEW v_popular_tracks AS
SELECT 
    t.id,
    t.spotify_track_id,
    t.name,
    t.artist,
    t.album,
    t.image_url,
    t.external_url,
    COUNT(up.id) as total_plays,
    COUNT(DISTINCT up.user_id) as unique_users,
    COUNT(DISTINCT up.hex_id) as unique_locations,
    MAX(up.played_at) as last_played_at
FROM tracks t
LEFT JOIN user_playback up ON t.id = up.track_id
GROUP BY t.id, t.spotify_track_id, t.name, t.artist, t.album, t.image_url, t.external_url
ORDER BY total_plays DESC;

-- Hex 活動視圖
CREATE OR REPLACE VIEW v_hex_activity AS
SELECT 
    hp.hex_id,
    hp.center_lat,
    hp.center_lng,
    hp.total_plays,
    hp.unique_users,
    hp.unique_tracks,
    hp.last_activity_at,
    COUNT(htt.id) as tracked_songs
FROM hex_properties hp
LEFT JOIN hex_top_tracks htt ON hp.hex_id = htt.hex_id
GROUP BY hp.hex_id, hp.center_lat, hp.center_lng, hp.total_plays, hp.unique_users, hp.unique_tracks, hp.last_activity_at
ORDER BY hp.total_plays DESC;

-- 插入一些初始資料 (可選)
-- INSERT INTO hex_properties (hex_id, center_lat, center_lng, resolution) VALUES 
-- ('example_hex', 25.0330, 121.5654, 9);

COMMENT ON TABLE users IS '用戶資料表';
COMMENT ON TABLE tracks IS '歌曲資料表';
COMMENT ON TABLE user_playback IS '用戶播放記錄表';
COMMENT ON TABLE hex_properties IS 'H3 六角形區域屬性表';
COMMENT ON TABLE hex_top_tracks IS '每個 Hex 的熱門歌曲表';
COMMENT ON TABLE user_sessions IS '用戶會話表';

COMMENT ON COLUMN user_playback.hex_id IS 'H3 六角形 ID (Resolution 9)';
COMMENT ON COLUMN hex_top_tracks.rank_score IS '排名分數 = play_count * 0.7 + unique_users * 0.3';

-- Migration 001 完成