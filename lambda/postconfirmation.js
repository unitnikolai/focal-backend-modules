import { Client } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const sm = new SecretsManagerClient();

export const handler = async (event) => {
  try {
    console.log("Post-confirmation handler triggered");
    
    const userId = event.request.userAttributes.sub;
    const email = event.request.userAttributes.email;
    const givenName = event.request.userAttributes.given_name || null;
    const familyName = event.request.userAttributes.family_name || null;
    
    if (!userId || !email) {
      throw new Error("Missing required user attributes");
    }
    
    const secret = await sm.send(
      new GetSecretValueCommand({
        SecretId: process.env.DB_SECRET_ID
      })
    );
    
    const creds = JSON.parse(secret.SecretString);
    const client = new Client({
      host: creds.host, 
      user: creds.username,
      password: creds.password,
      database: creds.dbname,
      port: 5432,
      ssl: true,
      connectionTimeoutMillis: 5000
    });
    
    await client.connect();
    
    await client.query(
      "INSERT INTO users(id, email, given_name, family_name) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [userId, email, givenName, familyName]
    );
    
    await client.end();
    console.log(`User ${userId} created successfully`);
         
    return event;
  } catch (error) {
    console.error("Error in post-confirmation handler:", error);
    throw error;
  }
};