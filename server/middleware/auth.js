const supabase = require("../supabase");

async function requireAuth(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const { data, error } = await supabase.auth.getUser(match[1]);

    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    req.user = data.user;
    return next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    return res.status(401).json({ message: "Unable to authenticate session" });
  }
}

module.exports = requireAuth;
