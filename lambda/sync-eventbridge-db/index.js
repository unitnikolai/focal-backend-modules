import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());

export const handler = async (event) => {
  for (const record of event.Records ?? [event]) {
    const detail = record.detail || JSON.parse(record.body || "{}");

    const { action, user_id, org_id, full_name } = detail;

    const key = {
      pk: `USER#${user_id}`,
      sk: `ORG#${org_id}`,
    };

    if (action === "ADD") {
      await dynamo.send(
        new PutCommand({
          TableName: process.env.MEMBERSHIP_TABLE,
          Item: {
            ...key,
            ...(full_name ? { full_name } : {}),
            created_at: new Date().toISOString(),
          },
        })
      );
    }

    if (action === "REMOVE") {
      await dynamo.send(
        new DeleteCommand({
          TableName: process.env.MEMBERSHIP_TABLE,
          Key: key,
        })
      );
    }
  }
};