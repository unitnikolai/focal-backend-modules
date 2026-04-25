import { Pool } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const sm = new SecretsManagerClient();
const eventBridge = new EventBridgeClient();
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

    let group_id;
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        group_id = body?.group_id;
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
    }
    if (!group_id) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing group_id" }) };
    }

    const pool = await getPool();
    try {
        const insertRes = await pool.query(
            `INSERT INTO group_members (user_id, group_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id, group_id) DO NOTHING
             RETURNING *`,
            [userId, group_id]
        );

        if (insertRes.rows.length === 0) {
            return {
                statusCode: 409,
                body: JSON.stringify({ error: "User is already a member of this group" })
            };
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Group joined successfully",
                user: insertRes.rows[0]
            })
        };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
    }
};