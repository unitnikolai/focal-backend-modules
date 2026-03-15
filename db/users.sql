CREATE TABLE users(
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    given_name VARCHAR(255),
    family_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    teacher_status BOOLEAN DEFAULT FALSE,
    school_id VARCHAR(255)
);

CREATE TABLE schools (
    id VARCHAR(255) PRIMARY KEY,
    school_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nfc_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_code VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_used TIMESTAMPTZ
);

CREATE TABLE sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    tag_id UUID NOT NULL REFERENCES nfc_tags(id),
    device_id VARCHAR(128),
    status VARCHAR(16) CHECK (status IN ('active','ended','expired')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    metadata JSONB
);

CREATE TABLE classroom(
    classroom_id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id),
    school_id VARCHAR(255) NOT NULL REFERENCES schools(id),
    created_at TIMESTAMP DEFAULT NOW()
);