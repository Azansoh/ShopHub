const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

module.exports.sendOTP = async (email, otpCode) => {
    const mailOptions = {
        from: `"ShopHub Security" <${process.env.EMAIL_USER}>`,
        to: email,
        replyTo: process.env.EMAIL_USER, // Helps lower spam scoring
        subject: `${otpCode} is your ShopHub verification code`,
        text: `Your verification code is: ${otpCode}. It expires in 5 minutes.`, // Plain text fallback
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
            </head>
            <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
                <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #333333; text-align: center; margin-top: 0;">ShopHub Account Verification</h2>
                    <p style="color: #666666; font-size: 16px;">Hello,</p>
                    <p style="color: #666666; font-size: 16px;">Please enter the following 6-digit verification code to complete your login/registration:</p>
                    
                    <div style="background-color: #f0f7ff; border: 1px dashed #0d6efd; border-radius: 6px; padding: 15px; text-align: center; margin: 25px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0d6efd;">${otpCode}</span>
                    </div>

                    <p style="color: #888888; font-size: 13px; text-align: center;">This code will expire in <strong>5 minutes</strong>.</p>
                    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 20px 0;" />
                    <p style="color: #aaaaaa; font-size: 11px; text-align: center;">If you did not request this code, you can safely ignore this email.</p>
                </div>
            </body>
            </html>
        `
    };

    await transporter.sendMail(mailOptions);
};