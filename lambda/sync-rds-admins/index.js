import { Pool } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const sm = new SecretsManagerClient();
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient());
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

export const handler = async () => {
    const db = await getPool();

    const { rows } = await db.query(
        "SELECT id, organization_id, given_name, family_name FROM users WHERE admin_status = TRUE AND organization_id IS NOT NULL"
    );

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
        const key = {
            pk: `USER#${row.id}`,
            sk: `ORG#${row.organization_id}`,
        };

        const existing = await dynamo.send(new GetCommand({
            TableName: process.env.MEMBERSHIP_TABLE,
            Key: key,
            ProjectionExpression: "pk",
        }));

        if (existing.Item) {
            skipped++;
            continue;
        }

        const full_name = `${row.given_name ?? ''} ${row.family_name ?? ''}`.trim();

        await dynamo.send(new PutCommand({
            TableName: process.env.MEMBERSHIP_TABLE,
            Item: {
                ...key,
                role: "admin",
                ...(full_name ? { full_name } : {}),
                created_at: new Date().toISOString(),
            },
            ConditionExpression: "attribute_not_exists(pk)",
        }));

        created++;
    }

    const summary = { total: rows.length, created, skipped };
    console.log("Sync complete:", summary);
    return summary;
};
