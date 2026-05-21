-- Support for operational metrics: track activity more granularly

-- 1. Add updated_at to user_journeys and sessions
ALTER TABLE user_journeys ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Create trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Apply update triggers
DROP TRIGGER IF EXISTS update_user_journeys_updated_at ON user_journeys;
CREATE TRIGGER update_user_journeys_updated_at
    BEFORE UPDATE ON user_journeys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Create trigger to touch parent session when a message is logged
CREATE OR REPLACE FUNCTION touch_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions SET updated_at = now() WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS on_message_touch_session ON messages;
CREATE TRIGGER on_message_touch_session
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION touch_session_on_message();
