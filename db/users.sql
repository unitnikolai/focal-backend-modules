CREATE TABLE organizations (
    id VARCHAR(255) PRIMARY KEY,
    organization_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_organizations_name ON organizations(organization_name);

CREATE TABLE users(
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    given_name VARCHAR(255),
    family_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admin_status BOOLEAN DEFAULT FALSE,
    organization_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization_id ON users(organization_id);


CREATE TABLE nfc_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_code VARCHAR(255) NOT NULL UNIQUE,
    device_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used TIMESTAMPTZ
);

CREATE INDEX idx_nfc_tags_code ON nfc_tags(tag_code);
CREATE INDEX idx_nfc_tags_device_name ON nfc_tags(device_name);

CREATE TABLE sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    tag_id UUID NOT NULL REFERENCES nfc_tags(id) ON DELETE RESTRICT,
    device_id VARCHAR(128) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('active','ended','expired')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    metadata JSONB
);

CREATE TABLE organizations(
    organization_id VARCHAR(255) NOT NULL REFERENCES organizations(id),
    organization_name VARCHAR(255)
)

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_tag_id ON sessions(tag_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_sessions_device_id ON sessions(device_id);

CREATE INDEX idx_sessions_user_ended ON sessions(user_id, ended_at DESC)
    WHERE status = 'ended' AND ended_at IS NOT NULL;
CREATE INDEX idx_sessions_user_started ON sessions(user_id, started_at DESC);

CREATE TABLE groups(
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    group_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_group_name_per_org UNIQUE (organization_id, group_name)
);

CREATE INDEX idx_groups_org_id ON groups(organization_id);

CREATE TABLE group_members(
    group_id UUID NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);