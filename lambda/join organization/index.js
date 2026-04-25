import { Pool } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import {EventBridgeClient, PutEventsCommand} from "@aws-sdk/client-eventbridge";


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
        ssl: { rejectUnauthorized : false },
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

    let orgId;
    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        orgId = body?.organization_id;
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
    }
    if (!orgId) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing organization_id" }) };
    }

    const pool = await getPool();
    try {
        // Check if organization exists
        const orgRes = await pool.query(
            "SELECT id, organization_name FROM organizations WHERE id = $1",
            [orgId]
        );
        if (!orgRes.rows[0]) {
            return { statusCode: 404, body: JSON.stringify({ error: "Organization not found" }) };
        }

        // Update user's organization_id
        const updateRes = await pool.query(
            "UPDATE users SET organization_id = $1 WHERE id = $2 RETURNING id, email, given_name, family_name, organization_id",
            [orgId, userId]
        );
        if (!updateRes.rows[0]) {
            return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
        }

        // Get groups for the organization
        const groupsRes = await pool.query(
            "SELECT group_id, group_name FROM groups WHERE organization_id = $1",
            [orgId]
        );
        //dynamodb sync via eventbridge
        try{
            await eventBridge.send(
                new PutEventsCommand({
                    Entries: [
                        {
                            Source: 'focal.app',
                            DetailType: 'organization_joined',
                            Detail: JSON.stringify({
                                action: 'ADD',
                                user_id: userId,
                                org_id: orgId,
                                full_name: `${updateRes.rows[0].given_name ?? ''} ${updateRes.rows[0].family_name ?? ''}`.trim(),
                            }),
                        },
                    ],
                })
            );
        }catch (error){
            console.error("Failed to send event to EventBridge:", error);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Organization joined successfully",
                user: updateRes.rows[0],
                organization: orgRes.rows[0],
                groups: groupsRes.rows
            })
        };
    } catch (e) {
        console.error(e);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) };
    }
}