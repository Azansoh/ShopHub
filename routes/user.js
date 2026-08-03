const express = require("express");
const router = express.Router();
const passport = require("passport");
const users = require("../controllers/user");

// --- Google OAuth Routes ---
router.get(
  ["/google", "/auth/google"],
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  ["/google/callback", "/auth/google/callback"],
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: "Google sign-in failed.",
  }),
  users.googleCallback // Must exist in controllers/user.js
);

// --- OTP Verification Routes ---
router.get("/verify-otp", users.renderVerifyForm); // Check this line!
router.post("/verify-otp", users.verifyOTP);        // Check this line!

// --- Local Authentication Routes ---
router.get("/signup", (req, res) => res.render("users/signup.ejs"));
router.post("/signup", users.signup);

router.get("/login", users.renderLoginForm);
router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: "Invalid username or password.",
  }),
  users.login
);

// --- Logout Route ---
router.get("/logout", users.logout);

module.exports = router;