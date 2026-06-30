import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.GMAIL_SMTP_PORT) || 465,
    secure: process.env.GMAIL_SMTP_SECURE === 'true',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

console.log(`[MAIL CONFIG] Loaded User: ${process.env.GMAIL_USER}`);
const pass = process.env.GMAIL_PASS || '';
console.log(`[MAIL CONFIG] Loaded Pass: ${pass.substring(0, 3)}...${pass.substring(pass.length - 3)} (Length: ${pass.length})`);

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('[MAIL CONFIG] ❌ Connection error:', error.message);
    } else {
        console.log('[MAIL CONFIG] ✅ Server is ready to take our messages');
    }
});

export const sendOTPEmail = async (email: string, code: string) => {
    const mailOptions = {
        from: `"Akshara Music Hub" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Your Akshara Music Hub Verification Code',
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ff8c00; text-align: center;">Welcome to Akshara Music Hub!</h2>
                <p>Thank you for joining our learning community. Please use the verification code below to activate your account:</p>
                <div style="background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff8c00;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #007bff;">${code}</span>
                </div>
                <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
                <p style="font-size: 11px; color: #999; text-align: center;">
                    Akshara Music Hub - Gamified Learning for Malaysia<br/>
                    Powered by @Akshara Music Hub Team
                </p>
            </div>
        `
    };

    try {
        console.log(`[MAIL] Attempting to send OTP to ${email}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MAIL] ✅ Email successfully sent: ${info.messageId}`);
        return true;
    } catch (error: any) {
        console.error('[MAIL] ❌ Error sending email:', error.message);
        if (error.code === 'EAUTH') {
            console.error('[MAIL] Authentication failed. Check GMAIL_USER and GMAIL_PASS (App Password).');
        } else if (error.code === 'ESOCKET') {
            console.error('[MAIL] Network/Socket error. Check firewall or SMTP port settings.');
        }
        return false;
    }
};

export const sendPasswordResetEmail = async (email: string, otp: string) => {
    const mailOptions = {
        from: `"Akshara Music Hub" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Reset Your Akshara Music Hub Password',
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #ff8c00; text-align: center;">Password Reset Request</h2>
                <p>We received a request to reset your Akshara Music Hub password. Use the code below to proceed:</p>
                <div style="background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px; margin: 20px 0; border: 2px dashed #ff8c00;">
                    <span style="font-size: 36px; font-weight: bold; letter-spacing: 5px; color: #007bff;">${otp}</span>
                </div>
                <p>This code will expire in <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email — your account remains secure.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
                <p style="font-size: 11px; color: #999; text-align: center;">
                    Akshara Music Hub - Gamified Learning for Malaysia<br/>
                    Powered by @Akshara Music Hub Team
                </p>
            </div>
        `
    };

    try {
        console.log(`[MAIL] Attempting to send password reset OTP to ${email}...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MAIL] ✅ Password reset email sent: ${info.messageId}`);
        return true;
    } catch (error: any) {
        console.error('[MAIL] ❌ Error sending password reset email:', error.message);
        return false;
    }
};
