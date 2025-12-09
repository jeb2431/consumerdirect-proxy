// 3) Login-As (agent login-as customer)
//    Step One from docs: POST /v1/customers/{customerToken}/otcs/login-as
//    Returns a one-time-code (OTC) which the frontend will exchange via
//    https://<website-domain>/auth?code=<one-time-code>
app.post("/consumerdirect/login-as", async (req, res) => {
  const authHeader = req.headers["x-internal-secret"];
  if (authHeader !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const body = req.body || {};
    const { customerToken, agentId } = body;

    if (!customerToken) {
      return res
        .status(400)
        .json({ error: "customerToken is required for login-as" });
    }

    if (!agentId) {
      return res
        .status(400)
        .json({ error: "agentId is required for login-as" });
    }

    const accessToken = await getAccessToken();

    const url = `${CD_BASE_URL}/v1/customers/${customerToken}/otcs/login-as`;

    console.log("CD login-as outbound request:", {
      url,
      body: { agentId },
    });

    const response = await axios.post(
      url,
      { agentId },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // Example response:
    // {
    //   "code": "pola-....",
    //   "expirationDateTime": "...",
    //   "type": "LOGIN_AS"
    // }
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(
      "ConsumerDirect login-as error:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      error: "ConsumerDirect login-as failed",
      details: error.response?.data || { message: error.message },
    });
  }
});
