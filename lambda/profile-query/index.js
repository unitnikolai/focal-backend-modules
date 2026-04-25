import { Pool } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient();
let pool; 

const getPool = async () => {
    if (pool) return pool;
    const secret = await sm.send(
        new GetSecretValueCommand({
            SecretId: process.env.DB_SECRET_ID
        })
    );
    const creds = JSON.parse(secret.SecretString);
    pool = new Pool({
        host: creds.host,
        user: creds.username,
        password: creds.password,
        database: creds.dbname,
        port: 5432,
        ssl: { rejectUnauthorized : false },
        connectionTimeoutMillis: 5000
    });
    return pool;
};

function getSubFromCookies(cookies) {
    for (const c of cookies ?? []) {
        const [key, ...rest] = c.split('=');
        if (key.trim() === 'accessToken') {
            const token = rest.join('=');
            const parts = token.split('.');
            if (parts.length < 2 || !parts[1]) return null;
            try {
                const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
                return payload?.sub ?? null;
            } catch {
                return null;
            }
        }
    }
    return null;
}

export const handler = async (event) => {
    const userId = getSubFromCookies(event.cookies);
    if (!userId) {
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }
    const pool = await getPool();
    try {
        const { rows } = await pool.query(
            "SELECT email, given_name, family_name, organization_id, organization_name FROM users JOIN organizations ON users.organization_id = organizations.id WHERE users.id = $1",
            [userId]
        );
        if (!rows[0]) {
            return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
        }
        return { statusCode: 200, body: JSON.stringify(rows[0]) };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
    }
};