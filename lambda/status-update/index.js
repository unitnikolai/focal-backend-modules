import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event) => {
    try {
        const { session_id } = JSON.parse(event.body);
        if (!session_id) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing required field: session_id" }) };
        }

        const now = new Date().toISOString();

        await dynamo.send(new UpdateCommand({
            TableName: process.env.SESSIONS_TABLE,
            Key: { session_id },
            UpdateExpression: "SET #s = :status, status_since = :now",
            ConditionExpression: "attribute_exists(session_id)",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: {
                ":status": "inactive",
                ":now": now,
            },
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Session marked inactive", session_id }),
        };
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            return { statusCode: 404, body: JSON.stringify({ error: "Session not found" }) };
        }
        console.error("Error updating session status:", error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
    }
};