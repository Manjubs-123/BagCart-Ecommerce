import nodemailer from "nodemailer";

export const sendOtpMail = async (email, otp) => {
  try {
    // Create a transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your Gmail address
        pass: process.env.EMAIL_PASS, // app password (not your Gmail password)
      },
    });

    // Email content
    const mailOptions = {
      from: `"BagCart Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `
        <div style="font-family:sans-serif; padding:20px;">
          <h2>OTP Verification</h2>
          <p>Your One-Time Password (OTP) is:</p>
          <h3 style="color:#007bff;">${otp}</h3>
          <p>This OTP will expire in <strong>2 minutes</strong>.</p>
          <p>If you didn’t request this, please ignore this email.</p>
          <br />
          <p>Thanks,<br/>BagCart Team</p>
        </div>
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};
