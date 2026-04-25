import { SignatureV4 } from "@smithy/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@smithy/protocol-http";

const endpoint = new URL(process.env.APPSYNC_ENDPOINT);

const signer = new SignatureV4({
  credentials: defaultProvider(),
  region: process.env.AWS_REGION,
  service: "appsync",
  sha256: Sha256,
});

const mutation = `
mutation PublishSessionUpdate(
  $session_id: ID!
  $user_id: String!
  $full_name: String
  $org_id: String!
  $group_id: String!
  $device_name: String
  $status: String!
  $status_since: String!
  $created_at: String!
  $ttl: Int
) {
  publishSessionUpdate(
    session_id: $session_id
    user_id: $user_id
    full_name: $full_name
    org_id: $org_id
    group_id: $group_id
    device_name: $device_name
    status: $status
    status_since: $status_since
    created_at: $created_at
    ttl: $ttl
  ) {
    session_id
    user_id
    full_name
    org_id
    group_id
    device_name
    created_at
    status
    status_since
    ttl
  }
}
`;

export const handler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;

    const session = record.dynamodb.NewImage;

    const variables = {
      session_id: session.session_id.S,
      user_id: session.user_id.S,
      full_name: session.full_name?.S ?? null,
      org_id: session.org_id.S,
      group_id: session.group_id?.S ?? null,
      device_name: session.device_name?.S ?? null,
      status: session.status?.S ?? null,
      status_since: session.status_since?.S ?? null,
      created_at: session.created_at?.S ?? null,
      ttl: session.ttl?.N ? Number(session.ttl.N) : null,
    };

    const body = JSON.stringify({ query: mutation, variables });

    const request = new HttpRequest({
      method: "POST",
      hostname: endpoint.hostname,
      path: endpoint.pathname,
      headers: {
        "Content-Type": "application/json",
        host: endpoint.hostname,
      },
      body,
    });

    const signed = await signer.sign(request);

    const res = await fetch(endpoint, {
      method: signed.method,
      headers: signed.headers,
      body: signed.body,
    });

    const result = await res.json();
    if (result.errors) {
      console.error("AppSync error:", JSON.stringify(result.errors));
    }
  }
};