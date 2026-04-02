// index.js
const { CognitoIdentityProviderClient, InitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");
const { randomBytes } = require("crypto");

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "us-east-2"
});

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON" })
    };
  }

  const { email, password } = body;
  if (!email || !password) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "email and password required" })
    };
  }

  try {
    const res = await client.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      })
    );

    const { AccessToken, RefreshToken } = res.AuthenticationResult;
    const csrfToken = randomBytes(32).toString("hex");
    const httpOnly = "Secure; HttpOnly; SameSite=Lax; Path=/";
    const readable = "Secure; SameSite=Lax; Path=/";
    const cookies = [
      `accessToken=${AccessToken}; ${httpOnly}; Max-Age=3600`,
      `csrfToken=${csrfToken}; ${readable}; Max-Age=3600`
    ];

    if (RefreshToken) {
      cookies.push(
        `refreshToken=${RefreshToken}; ${httpOnly}; Max-Age=${60 * 60 * 24 * 30}`
      );
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      cookies: cookies,
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("Login failed:", err.message);
    const msg =
      err.name === "NotAuthorizedException"     ? "Incorrect email or password" :
      err.name === "UserNotFoundException"       ? "No account found with that email" :
      err.name === "UserNotConfirmedException"   ? "Please verify your email first" :
      err.name === "PasswordResetRequiredException" ? "Password reset required" :
                                                  "Sign in failed, please try again";
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: msg })
    };
  }
};