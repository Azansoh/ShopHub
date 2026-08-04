const User = require("../Models/user");
const OTP = require("../Models/otp");
const { sendOTP } = require("../utils/email");

// Helper function to generate a random 6-digit code
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- 1. Signup Controller ---
module.exports.signup = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // Regex Rules
        const usernameRegex = /^(?=.*[A-Z])[a-zA-Z0-9_]{3,}$/;
        const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&#\-_])[^\s]{6,}$/;

        if (!usernameRegex.test(username)) {
            req.flash("error", "Username must be at least 3 characters long, contain at least one uppercase letter, and use only letters, numbers, or underscores.");
            return res.render("users/signup", { username, email });
        }

        if (!passwordRegex.test(password)) {
            req.flash("error", "Password must be at least 6 characters long and contain at least one letter, one number, and one special character.");
            return res.render("users/signup", { username, email });
        }

        // --- CHECK EXISTING EMAIL ---
        const existingEmail = await User.findOne({ email: normalizedEmail });
        
        if (existingEmail) {
            if (!existingEmail.isVerified) {
                const otpCode = generateOTP();
                await OTP.deleteMany({ userId: existingEmail._id });
                await OTP.create({ userId: existingEmail._id, code: otpCode });

                try {
                    await sendOTP(existingEmail.email, otpCode);
                } catch (emailErr) {
                    console.error("Email send failed for existing unverified user:", emailErr);
                }

                req.session.pendingUserId = existingEmail._id;
                req.flash("info", "This email was registered but unverified. A new 6-digit code has been sent!");
                
                return req.session.save((err) => {
                    if (err) return next(err);
                    res.redirect("/verify-otp");
                });
            }

            req.flash("error", "An account with that email already exists. Please log in.");
            return res.render("users/signup", { username, email });
        }

        // --- CHECK EXISTING USERNAME ---
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
            req.flash("error", "That username is already taken.");
            return res.render("users/signup", { username, email });
        }

        // --- REGISTER NEW USER (Unverified) ---
        const newUser = new User({
            username,
            email: normalizedEmail,
            isVerified: false
        });

        const registeredUser = await User.register(newUser, password);

        // Generate & Save OTP
        const otpCode = generateOTP();
        await OTP.create({
            userId: registeredUser._id,
            code: otpCode
        });

        // Set pending user ID in session BEFORE sending email
        req.session.pendingUserId = registeredUser._id;

        // Try sending OTP safely
        try {
            await sendOTP(registeredUser.email, otpCode);
            req.flash("success", "A 6-digit verification code has been sent to your email.");
        } catch (emailErr) {
            console.error("Failed to send OTP email:", emailErr);
            req.flash("error", "User created, but failed to send verification email. Please check your email credentials.");
        }
        
        // Save session explicitly to guarantee cookie persistence
        req.session.save((err) => {
            if (err) {
                console.error("Session save error during signup:", err);
                return next(err);
            }
            res.redirect("/verify-otp");
        });

    } catch (err) {
        console.error("Signup Error:", err);
        req.flash("error", err.message);
        return res.render("users/signup", {
            username: req.body.username || "",
            email: req.body.email || ""
        });
    }
};

// --- 2. Google Callback Controller ---
module.exports.googleCallback = async (req, res, next) => {
    try {
        const user = req.user;

        if (user.isVerified) {
            req.flash("success", `Welcome back, ${user.username || user.email}!`);
            const redirectUrl = req.session.redirectUrl || "/products";
            delete req.session.redirectUrl;
            return req.session.save(() => res.redirect(redirectUrl));
        }

        const otpCode = generateOTP();
        await OTP.deleteMany({ userId: user._id });
        await OTP.create({ userId: user._id, code: otpCode });

        try {
            await sendOTP(user.email, otpCode);
        } catch (emailErr) {
            console.error("Email send failed on Google callback:", emailErr);
        }

        const pendingUserId = user._id;

        req.logout((err) => {
            if (err) return next(err);

            req.session.pendingUserId = pendingUserId;
            req.flash("success", "Security check: Please enter the 6-digit code sent to your email.");
            req.session.save(() => res.redirect("/verify-otp"));
        });
    } catch (err) {
        next(err);
    }
};

// --- 3. Render Verification Form ---
module.exports.renderVerifyForm = (req, res) => {
    if (!req.session.pendingUserId) {
        req.flash("error", "Session expired. Please log in or sign up again.");
        return res.redirect("/login");
    }
    res.render("users/verify-otp");
};

// --- 4. Verify Submitted OTP Code ---
module.exports.verifyOTP = async (req, res, next) => {
    try {
        const { otp } = req.body;
        const userId = req.session.pendingUserId;

        if (!userId) {
            req.flash("error", "Session expired. Please sign up again.");
            return res.redirect("/signup");
        }

        const otpRecord = await OTP.findOne({ userId, code: otp });

        if (!otpRecord) {
            req.flash("error", "Invalid or expired OTP code.");
            return res.redirect("/verify-otp");
        }

        const user = await User.findById(userId);
        if (!user) {
            req.flash("error", "User account not found. Please sign up again.");
            return res.redirect("/signup");
        }

        user.isVerified = true;
        await user.save();

        await OTP.deleteOne({ _id: otpRecord._id });
        delete req.session.pendingUserId;

        req.login(user, (err) => {
            if (err) return next(err);
            req.flash("success", "Email verified successfully! Welcome to ShopHub.");
            res.redirect("/products");
        });

    } catch (err) {
        console.error("OTP Verification Error:", err);
        req.flash("error", "Verification failed. Please try again.");
        res.redirect("/verify-otp");
    }
};

// --- 5. Render Login Form ---
module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
};

// --- 6. Login Handler ---
module.exports.login = async (req, res, next) => {
    try {
        if (!req.user.isVerified) {
            const otpCode = generateOTP();
            await OTP.deleteMany({ userId: req.user._id });
            await OTP.create({ userId: req.user._id, code: otpCode });

            try {
                await sendOTP(req.user.email, otpCode);
            } catch (emailErr) {
                console.error("Email send failed during login check:", emailErr);
            }

            const pendingUserId = req.user._id;

            return req.logout((err) => {
                if (err) return next(err);
                req.session.pendingUserId = pendingUserId;
                req.flash("error", "Your account is not verified. A new 6-digit code was sent to your email.");
                req.session.save(() => res.redirect("/verify-otp"));
            });
        }

        const username = req.user ? req.user.username : req.body.username;
        req.flash("success", `Log-In Success! Welcome back, ${username}`);

        req.session.save((err) => {
            if (err) return next(err);
            res.redirect("/products");
        });
    } catch (err) {
        next(err);
    }
};

// --- 7. Logout Handler ---
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);

        req.flash("success", "Logged out successfully!");
        res.redirect("/products");
    });
};