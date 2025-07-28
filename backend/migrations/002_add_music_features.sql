-- SoundMate AR Database Schema
-- Migration 002: Add music features and enhanced analytics

-- 添加用戶位置欄位
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 添加歌曲音樂特徵欄位
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_features JSONB;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS popularity INTEGER;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS explicit BOOLEAN DEFAULT FALSE;

-- 添加播放記錄更多欄位
ALTER TABLE user_playback ADD COLUMN IF NOT EXISTS track_name VARCHAR(500);
ALTER TABLE user_playback ADD COLUMN IF NOT EXISTS artist_name VARCHAR(500);
ALTER TABLE user_playback ADD COLUMN IF NOT EXISTS album_name VARCHAR(500);
ALTER TABLE user_playback ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE user_playback ADD COLUMN IF NOT EXISTS audio_features JSONB;

-- 添加 Hex 屬性的音樂特徵統計
ALTER TABLE hex_properties ADD COLUMN IF NOT EXISTS avg_energy DECIMAL(5, 4);
ALTER TABLE hex_properties ADD COLUMN IF NOT EXISTS avg_valence DECIMAL(5, 4);
ALTER TABLE hex_properties ADD COLUMN IF NOT EXISTS avg_danceability DECIMAL(5, 4);
ALTER TABLE hex_properties ADD COLUMN IF NOT EXISTS avg_tempo DECIMAL(6, 2);
ALTER TABLE hex_properties ADD COLUMN IF NOT EXISTS dominant_genre VARCHAR(100);
ALTER TABLE hex_properties ADD COLUMN IF NOT EXISTS color_hex VARCHAR(7);

-- 創建音樂特徵索引
CREATE INDEX IF NOT EXISTS idx_tracks_audio_features ON tracks USING gin(audio_features);
CREATE INDEX IF NOT EXISTS idx_playback_audio_features ON user_playback USING gin(audio_features);

-- 創建用戶位置索引
CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 創建地理位置搜索函數
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lng1 DECIMAL,
    lat2 DECIMAL, lng2 DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    RETURN 6371 * acos(
        cos(radians(lat1)) * cos(radians(lat2)) *
        cos(radians(lng2) - radians(lng1)) +
        sin(radians(lat1)) * sin(radians(lat2))
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 創建顏色計算函數
CREATE OR REPLACE FUNCTION calculate_hex_color(
    avg_energy DECIMAL,
    avg_valence DECIMAL,
    avg_danceability DECIMAL
) RETURNS VARCHAR(7) AS $$
DECLARE
    hue INTEGER;
    saturation INTEGER;
    lightness INTEGER;
BEGIN
    -- 使用音樂特徵計算HSV顏色
    -- 色相基於能量和舞曲性
    hue := ROUND((COALESCE(avg_energy, 0.5) * 0.6 + COALESCE(avg_danceability, 0.5) * 0.4) * 360);
    
    -- 飽和度基於愉悅度
    saturation := ROUND(COALESCE(avg_valence, 0.5) * 80 + 20); -- 20-100%
    
    -- 亮度固定
    lightness := 50;
    
    -- 簡化的HSV到HEX轉換 (這裡使用預設的顏色映射)
    IF hue < 60 THEN
        RETURN '#FF6B6B'; -- 紅色系 (高能量)
    ELSIF hue < 120 THEN
        RETURN '#4ECDC4'; -- 青色系 (平衡)
    ELSIF hue < 180 THEN
        RETURN '#45B7D1'; -- 藍色系 (冷靜)
    ELSIF hue < 240 THEN
        RETURN '#96CEB4'; -- 綠色系 (自然)
    ELSIF hue < 300 THEN
        RETURN '#FFEAA7'; -- 黃色系 (快樂)
    ELSE
        RETURN '#DDA0DD'; -- 紫色系 (神秘)
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 更新 Hex 顏色的觸發器函數
CREATE OR REPLACE FUNCTION update_hex_color()
RETURNS TRIGGER AS $$
BEGIN
    NEW.color_hex := calculate_hex_color(NEW.avg_energy, NEW.avg_valence, NEW.avg_danceability);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
CREATE TRIGGER hex_color_update_trigger
    BEFORE INSERT OR UPDATE OF avg_energy, avg_valence, avg_danceability
    ON hex_properties
    FOR EACH ROW
    EXECUTE FUNCTION update_hex_color();

-- 創建音樂統計視圖
CREATE OR REPLACE VIEW v_music_analytics AS
SELECT 
    DATE_TRUNC('hour', up.played_at) as time_bucket,
    up.hex_id,
    COUNT(*) as play_count,
    COUNT(DISTINCT up.user_id) as unique_users,
    COUNT(DISTINCT up.track_id) as unique_tracks,
    AVG((up.audio_features->>'energy')::DECIMAL) as avg_energy,
    AVG((up.audio_features->>'valence')::DECIMAL) as avg_valence,
    AVG((up.audio_features->>'danceability')::DECIMAL) as avg_danceability,
    AVG((up.audio_features->>'tempo')::DECIMAL) as avg_tempo
FROM user_playback up
WHERE up.played_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
  AND up.audio_features IS NOT NULL
GROUP BY DATE_TRUNC('hour', up.played_at), up.hex_id
ORDER BY time_bucket DESC;

-- 創建用戶偏好分析視圖
CREATE OR REPLACE VIEW v_user_preferences AS
SELECT 
    up.user_id,
    u.display_name,
    COUNT(*) as total_plays,
    COUNT(DISTINCT up.track_id) as unique_tracks,
    COUNT(DISTINCT up.hex_id) as locations_visited,
    AVG((up.audio_features->>'energy')::DECIMAL) as preferred_energy,
    AVG((up.audio_features->>'valence')::DECIMAL) as preferred_valence,
    AVG((up.audio_features->>'danceability')::DECIMAL) as preferred_danceability,
    AVG((up.audio_features->>'tempo')::DECIMAL) as preferred_tempo,
    MIN(up.played_at) as first_play,
    MAX(up.played_at) as last_play
FROM user_playback up
JOIN users u ON u.id = up.user_id
WHERE up.played_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
  AND up.audio_features IS NOT NULL
GROUP BY up.user_id, u.display_name
ORDER BY total_plays DESC;

-- Migration 002 完成