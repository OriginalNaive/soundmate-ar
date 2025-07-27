-- Migration tracking table
CREATE TABLE IF NOT EXISTS migration_history (
    version VARCHAR(10) PRIMARY KEY,
    description TEXT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);