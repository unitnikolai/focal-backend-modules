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
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });
    return pool;
};

function getSubFromBearerToken(authorizationHeader) {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) return null;
    const token = authorizationHeader.slice(7);
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        return payload?.sub ?? null;
    } catch {
        return null;
    }
}

export const handler = async (event) => {
    const userId = getSubFromBearerToken(event.headers?.Authorization || event.headers?.authorization);
    if (!userId) {
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    const pool = await getPool();
    try {
        const result = await pool.query(
            `SELECT id, given_name, family_name, users.organization_id, group_name, group_id FROM users JOIN groups ON users.organization_id = groups.organization_id WHERE users.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: "User not found" })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(result.rows[0])
        };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
    }
};