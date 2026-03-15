CREATE TABLE users(
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    given_name_name VARCHAR(255),
    family_name_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    teacher_status BOOLEAN DEFAULT FALSE,
    school_id VARCHAR(255),
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id UUID NOT NULL REFERENCES nfc_tags(id),
    user_id UUID NOT NULL,
    device_id VARCHAR(128),
    status VARCHAR(16) (status IN ('active','ended','expired')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    metadata JSONB
);