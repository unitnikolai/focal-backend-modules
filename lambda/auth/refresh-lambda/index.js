const {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const { randomBytes } = require("crypto");

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
});

function extractCookie(cookiesArray, cookieName) {
  for (const cookieStr of cookiesArray) {
    const pairs = cookieStr.split(";");
    for (const pair of pairs) {
      const [key, ...rest] = pair.trim().split("=");
      if (key === cookieName) return rest.join("=");
    }
  }
  return null;
}

exports.handler = async (event) => {
  const cookies = event.cookies ?? [];
  const refreshToken = extractCookie(cookies, "refreshToken");

  if (!refreshToken) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "No refresh token" }),
    };
  }

  try {
    const res = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      })
    );

    const { AccessToken, RefreshToken } = res.AuthenticationResult;
    const csrfToken = randomBytes(32).toString("hex");

    const httpOnly = "Secure; HttpOnly; SameSite=Lax; Path=/";
    const readable = "Secure; SameSite=Lax; Path=/";

    const responseCookies = [
      `accessToken=${AccessToken}; ${httpOnly}; Max-Age=3600`,
      `csrfToken=${csrfToken}; ${readable}; Max-Age=3600`,
    ];

    if (RefreshToken) {
      responseCookies.push(
        `refreshToken=${RefreshToken}; ${httpOnly}; Max-Age=${60 * 60 * 24 * 30}`
      );
    }

    return {
      statusCode: 200,
      multiValueHeaders: { "Set-Cookie": responseCookies },
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error("Refresh failed:", err.message);

    const expired =
      err.name === "NotAuthorizedException" ||
      err.name === "TokenExpiredException";

    return {
      statusCode: expired ? 401 : 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: expired ? "Session expired" : "Refresh failed",
      }),
    };
  }
};