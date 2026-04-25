import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());


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
    try {
        const { org_id, group_id, device_name, status } = JSON.parse(event.body);
        const user_id = getSubFromBearerToken(event.headers?.Authorization || event.headers?.authorization);
        if (!user_id || !org_id || !group_id) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields: user_id, org_id, group_id" }) };
        }

        if (
            typeof org_id !== 'string' || typeof group_id !== 'string' ||
            typeof user_id !== 'string' ||
            (device_name != null && typeof device_name !== 'string') ||
            (status != null && typeof status !== 'string')
        ) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid field types" }) };
        }

        const MAX_LEN = 128;
        if (
            org_id.length > MAX_LEN || group_id.length > MAX_LEN ||
            user_id.length > MAX_LEN ||
            (device_name && device_name.length > MAX_LEN) ||
            (status && status.length > MAX_LEN)
        ) {
            return { statusCode: 400, body: JSON.stringify({ error: "Field value too long" }) };
        }

        const membership = await dynamo.send(new GetCommand({
            TableName: process.env.MEMBERSHIP_TABLE,
            Key: { pk: `USER#${user_id}`, sk: `ORG#${org_id}` },
        }));

        if (!membership.Item) {
            return { statusCode: 403, body: JSON.stringify({ error: "User is not a member of this organization" }) };
        }

        const now = new Date().toISOString();
        const ttl = Math.floor(Date.now() / 1000) + 86400; // 24h TTL

        // Check for existing session for this user in this org
        const existing = await dynamo.send(new QueryCommand({
            TableName: process.env.SESSIONS_TABLE,
            IndexName: 'user-index',
            KeyConditionExpression: 'user_id = :uid',
            FilterExpression: 'org_id = :oid',
            ExpressionAttributeValues: {
                ':uid': user_id,
                ':oid': org_id,
            },
            Limit: 1,
        }));

        const existingSession = existing.Items?.[0];
        const session_id = existingSession?.session_id ?? randomUUID();
        const normalizedStatus = (status || 'active').toLowerCase();

        const session = {
            session_id,
            user_id,
            full_name: membership.Item.full_name || null,
            org_id,
            group_id,
            device_name: device_name || null,
            created_at: existingSession?.created_at ?? now,
            status: normalizedStatus,
            status_since: now,
            ttl,
        };

        await dynamo.send(new PutCommand({
            TableName: process.env.SESSIONS_TABLE,
            Item: session,
        }));

        return {
            statusCode: existingSession ? 200 : 201,
            body: JSON.stringify({ message: existingSession ? "Session updated" : "Session created", session_id }),
        };
    } catch (error) {
        console.error("Error ingesting session:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
};