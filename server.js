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
