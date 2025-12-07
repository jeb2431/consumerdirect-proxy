// Get credit score
app.post("/consumerdirect/get-credit-score", async (req, res) => {
  const authHeader = req.headers["x-internal-secret"];
  if (authHeader !== INTERNAL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { customerToken } = req.body;

    if (!customerToken) {
      return res.status(400).json({ error: "customerToken is required" });
    }

    // 1) Get JWT token
    const accessToken = await getAccessToken();

    // 2) Call ConsumerDirect API with JWT
    const response = await axios.get(
      `${CD_BASE_URL}/v1/customers/${customerToken}/credit-scores`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "ConsumerDirect API Error:",
      error.response?.data || error.message
    );
    res.status(500).json({
      error: "ConsumerDirect request failed",
      details: error.response?.data || { message: error.message },
    });
  }
});
