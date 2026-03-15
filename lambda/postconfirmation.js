import { Client } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient();

export const handler = async (event) => {

  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;
  const first_name = event.requests.userAttributes.given_name || null;
  const secret = await sm.send(
    new GetSecretValueCommand({
      SecretId: "db_credentials"
    })
  );

  const creds = JSON.parse(secret.SecretString);

  const client = new Client({
    host: creds.host, 
    user: creds.username,
    password: creds.password,
    database: creds.dbname,
    port: 5432,
    ssl: true
  });

  await client.connect();

  await client.query(
    "INSERT INTO users(id, email) VALUES($1,$2)",
    [userId, email]
  );

  await client.end();

  return event;s
};