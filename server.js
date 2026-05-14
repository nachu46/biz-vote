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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Email server running on http://localhost:${PORT}`);
});
