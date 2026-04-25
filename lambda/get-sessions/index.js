import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());


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
    if (!userId){
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }
    try {
        const org_id = event.queryStringParameters?.org_id;
        if (!org_id) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing required field: org_id" }) };
        }

        const membership = await dynamo.send(new GetCommand({
            TableName: process.env.MEMBERSHIP_TABLE,
            Key: { pk: `USER#${userId}`, sk: `ORG#${org_id}` },
        }));

        if (!membership.Item || membership.Item.role !== 'admin') {
            return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
        }

        const result = await dynamo.send(new QueryCommand({
            TableName: process.env.SESSIONS_TABLE,
            IndexName: 'org-index',
            KeyConditionExpression: 'org_id = :org_id',
            ExpressionAttributeValues: { ':org_id': org_id },
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ sessions: result.Items }),
        };
    } catch (error) {
        console.error("Error fetching sessions:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
};