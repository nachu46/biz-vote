import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  pool: true, // Use connection pooling for better performance
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD
  }
});

app.post('/send-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required' });
  }

  // Send email in the background without awaiting
  transporter.sendMail({
    from: process.env.SENDER_EMAIL,
    to: email,
    subject: 'Your Voting App OTP',
    text: `Your login code is: ${otp}. This code will expire soon.`
  }).catch(err => {
    console.error('Failed to send email in background:', err);
  });

  // Respond immediately to the frontend
  res.json({ success: true });
});

app.post('/send-results', (req, res) => {
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

  // Send in background sequentially to avoid SMTP rate-limiting
  (async () => {
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      try {
        await transporter.sendMail({
          from: process.env.SENDER_EMAIL,
          to: email.trim(),
          subject: '🏆 Official Results: Company Vote 2026 🏆',
          html: htmlContent
        });
      } catch (err) {
        console.error('Failed to send results email to:', email, err);
      }
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  })();

  res.json({ success: true });
});

app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Email server running on http://localhost:${PORT}`);
  
  // Keep-alive ping to prevent the server from sleeping (34 minutes)
  const PING_INTERVAL = 34 * 60 * 1000;
  setInterval(() => {
    const url = process.env.SERVER_URL || `http://localhost:${PORT}`;
    fetch(`${url}/ping`)
      .then(res => console.log(`[Keep-alive] Pinged server, status: ${res.status}`))
      .catch(err => console.error(`[Keep-alive] Ping failed:`, err.message));
  }, PING_INTERVAL);
});
