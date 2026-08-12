const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'Kora App <noreply@bmsdyna.live>';

const APP_NAME = process.env.APP_NAME || 'Kora'

const sendEmail = async ({ to, subject, html }) => {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('❌ Resend email error:', error);
      throw new Error(error.message || 'Failed to send email');
    }

    return data;
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    throw new Error('Failed to send email');
  }
};

const colors = {
  background: '#F5E9D8',
  text: '#3C2A21',
  primary: '#5B8C5A',
  button: '#E76F51',
  accent: '#2A9D8F',
  white: '#FFFFFF',
  muted: '#7A6658',
};

const emailLayout = ({ title, previewText, children }) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>
    </head>

    <body style="
      margin: 0;
      padding: 0;
      background-color: ${colors.background};
      font-family: Arial, Helvetica, sans-serif;
      color: ${colors.text};
    ">
      <div style="
        display: none;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        color: transparent;
      ">
        ${previewText || ''}
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="
        background-color: ${colors.background};
        padding: 40px 16px;
      ">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="
              max-width: 560px;
              background-color: ${colors.white};
              border-radius: 18px;
              overflow: hidden;
              box-shadow: 0 8px 24px rgba(60, 42, 33, 0.12);
            ">

              <tr>
                <td align="center" style="
                  background-color: ${colors.primary};
                  padding: 28px 24px;
                ">
                  <h1 style="
                    margin: 0;
                    color: #ffffff;
                    font-size: 26px;
                    line-height: 1.3;
                    font-weight: 700;
                  ">
                    ${APP_NAME}
                  </h1>
                </td>
              </tr>

              <tr>
                <td style="padding: 32px 28px;">
                  ${children}
                </td>
              </tr>

              <tr>
                <td align="center" style="
                  padding: 20px 24px;
                  background-color: #faf7f1;
                  border-top: 1px solid #eadfce;
                ">
                  <p style="
                    margin: 0;
                    color: ${colors.muted};
                    font-size: 13px;
                    line-height: 1.6;
                  ">
                    You are receiving this email because you have an account with ${APP_NAME}.
                  </p>

                  <p style="
                    margin: 8px 0 0;
                    color: ${colors.muted};
                    font-size: 12px;
                  ">
                    &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

const sendWelcomeEmail = async ({ email, firstName }) => {
  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME}`,
    html: emailLayout({
      title: `Welcome to ${APP_NAME}`,
      previewText: `Welcome to ${APP_NAME}. Your account has been created successfully.`,
      children: `
        <h2 style="
          margin: 0 0 16px;
          color: ${colors.text};
          font-size: 24px;
          line-height: 1.3;
        ">
          Welcome, ${firstName}!
        </h2>

        <p style="
          margin: 0 0 16px;
          color: ${colors.text};
          font-size: 16px;
          line-height: 1.7;
        ">
          Your account has been created successfully.
        </p>

        <p style="
          margin: 0 0 24px;
          color: ${colors.text};
          font-size: 16px;
          line-height: 1.7;
        ">
          You can now log in and start ordering meals safely based on your food preferences and allergens.
        </p>

        <div style="
          background-color: #f4fbf7;
          border-left: 4px solid ${colors.accent};
          padding: 14px 16px;
          border-radius: 10px;
          margin-bottom: 24px;
        ">
          <p style="
            margin: 0;
            color: ${colors.text};
            font-size: 14px;
            line-height: 1.6;
          ">
            Your preferences help us make your food ordering experience safer and more personalized.
          </p>
        </div>

        <p style="
          margin: 0;
          color: ${colors.muted};
          font-size: 15px;
          line-height: 1.6;
        ">
          Thank you for joining ${APP_NAME}.
        </p>
      `,
    }),
  });
};

const sendOtpEmail = async ({ email, firstName, otp, ipAddress, location, deviceInfo }) => {
  return sendEmail({
    to: email,
    subject: 'Your OTP Code & Login Attempt Details',
    html: emailLayout({
      title: 'Your OTP Code',
      previewText: `Your OTP code is ${otp}. It expires in 10 minutes.`,
      children: `
        <h2 style="
          margin: 0 0 16px;
          color: ${colors.text};
          font-size: 24px;
          line-height: 1.3;
        ">
          Hello ${firstName},
        </h2>

        <p style="
          margin: 0 0 20px;
          color: ${colors.text};
          font-size: 16px;
          line-height: 1.7;
        ">
          Use the OTP code below to continue with your verification.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <div style="
            display: inline-block;
            letter-spacing: 8px;
            background-color: ${colors.background};
            color: ${colors.text};
            padding: 18px 28px;
            border-radius: 14px;
            border: 2px dashed ${colors.accent};
            font-size: 32px;
            font-weight: 700;
          ">
            ${otp}
          </div>
        </div>

        <p style="
          margin: 0 0 24px;
          color: ${colors.text};
          font-size: 15px;
          line-height: 1.7;
          text-align: center;
        ">
          This code will expire in <strong>10 minutes</strong>.
        </p>

        <!-- Security Details Block -->
        <div style="
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 16px;
          border-radius: 10px;
          margin-bottom: 24px;
        ">
          <h3 style="margin: 0 0 12px; color: ${colors.text}; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
            Login Attempt Details
          </h3>
          <ul style="
            margin: 0;
            padding: 0;
            list-style: none;
            color: ${colors.text};
            font-size: 14px;
            line-height: 1.6;
          ">
            <li style="margin-bottom: 6px;"><strong>Device:</strong> ${deviceInfo}</li>
            <li style="margin-bottom: 6px;"><strong>Location:</strong> ${location}</li>
            <li><strong>IP Address:</strong> ${ipAddress}</li>
          </ul>
        </div>

        <div style="
          background-color: #fff5f1;
          border-left: 4px solid ${colors.button};
          padding: 14px 16px;
          border-radius: 10px;
        ">
          <p style="
            margin: 0;
            color: ${colors.text};
            font-size: 14px;
            line-height: 1.6;
          ">
            If you did not request this code, your password may be compromised. Please ignore this email and reset your password immediately.
          </p>
        </div>
      `,
    }),
  });
};

const sendResetPasswordEmail = async ({ email, firstName, resetLink }) => {
  return sendEmail({
    to: email,
    subject: 'Reset Your Password',
    html: emailLayout({
      title: 'Reset Your Password',
      previewText: 'Reset your password using the secure link provided.',
      children: `
        <h2 style="
          margin: 0 0 16px;
          color: ${colors.text};
          font-size: 24px;
          line-height: 1.3;
        ">
          Hello ${firstName},
        </h2>

        <p style="
          margin: 0 0 16px;
          color: ${colors.text};
          font-size: 16px;
          line-height: 1.7;
        ">
          You requested to reset your password.
        </p>

        <p style="
          margin: 0 0 24px;
          color: ${colors.text};
          font-size: 16px;
          line-height: 1.7;
        ">
          Click the button below to create a new password for your account.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" target="_blank" style="
            display: inline-block;
            padding: 14px 26px;
            background-color: ${colors.button};
            color: #ffffff;
            text-decoration: none;
            border-radius: 999px;
            font-size: 16px;
            font-weight: 700;
          ">
            Reset Password
          </a>
        </div>

        <p style="
          margin: 0 0 12px;
          color: ${colors.text};
          font-size: 15px;
          line-height: 1.7;
        ">
          This reset link will expire in <strong>15 minutes</strong>.
        </p>

        <div style="
          background-color: #f4fbf7;
          border-left: 4px solid ${colors.accent};
          padding: 14px 16px;
          border-radius: 10px;
          margin: 24px 0;
        ">
          <p style="
            margin: 0;
            color: ${colors.text};
            font-size: 14px;
            line-height: 1.6;
          ">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>

        <p style="
          margin: 0 0 8px;
          color: ${colors.muted};
          font-size: 13px;
          line-height: 1.6;
        ">
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="
          margin: 0;
          word-break: break-all;
          color: ${colors.accent};
          font-size: 13px;
          line-height: 1.6;
        ">
          ${resetLink}
        </p>
      `,
    }),
  });
};

module.exports = {
  sendWelcomeEmail,
  sendOtpEmail,
  sendResetPasswordEmail,
};