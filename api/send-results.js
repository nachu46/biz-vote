import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  pool: true,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD
  }
});

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { emails, menWinner, menVotes, womenWinner, womenVotes } = req.body;
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Recipient emails are required' });
  }

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #07080f; color: #ffffff; padding: 40px 20px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="display: inline-block; font-size: 40px; margin-bottom: 10px;">🏆</div>
        <h1 style="color: #6366f1; font-size: 28px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.05em;">Voting Results Are In!</h1>
        <p style="font-size: 15px; color: #a5b4fc; margin: 8px 0 0 0; opacity: 0.85;">Official outcomes for the Company Vote 2026</p>
      </div>

      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(99,102,241,0.08);">
        <h2 style="color: #8b5cf6; margin: 0 0 12px 0; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">👨 Men's Category Winner</h2>
        <p style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 6px 0; letter-spacing: 0.02em;">${menWinner}</p>
        <div style="display: inline-block; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 4px 12px; font-size: 13px; font-weight: 600; color: #a5b4fc;">
          ${menVotes} Vote${menVotes !== 1 ? 's' : ''}
        </div>
      </div>

      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(236, 72, 153, 0.25); border-radius: 16px; padding: 24px; margin-bottom: 30px; box-shadow: 0 4px 20px rgba(236,72,153,0.08);">
        <h2 style="color: #ec4899; margin: 0 0 12px 0; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">👩 Women's Category Winner</h2>
        <p style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 0 0 6px 0; letter-spacing: 0.02em;">${womenWinner}</p>
        <div style="display: inline-block; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 8px; padding: 4px 12px; font-size: 13px; font-weight: 600; color: #f9a8d4;">
          ${womenVotes} Vote${womenVotes !== 1 ? 's' : ''}
        </div>
      </div>

      <div style="text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 20px;">
        <p style="font-size: 12px; color: #5a5a7a; margin: 0; font-weight: 500;">This is an automated official email from the Corporate Voting System.</p>
        <p style="font-size: 11px; color: #3e3e5a; margin: 4px 0 0 0;">&copy; 2026 Company Vote. All rights reserved.</p>
      </div>
    </div>
  `;

  try {
    const sendPromises = emails.map(email => 
      transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: email.trim(),
        subject: '🏆 Official Results: Company Vote 2026 🏆',
        html: htmlContent
      })
    );

    await Promise.all(sendPromises);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Failed to send results email:', err);
    res.status(500).json({ error: 'Failed to send results email' });
  }
}
