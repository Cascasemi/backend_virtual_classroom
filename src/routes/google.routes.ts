import { Router } from 'express';
import { getOAuthClient } from '../services/googleCalendar.service';
import { encodeGoogleState, decodeGoogleState } from '../utils/googleState';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { auth } from '../middleware/auth';

const router = Router();

const scopes = ['https://www.googleapis.com/auth/calendar.events'];

// Protected: generate auth URL
router.get('/auth-url', auth('teacher','admin'), async (req: AuthRequest, res) => {
  try {
    const client = getOAuthClient();
    const state = encodeGoogleState({ uid: req.user.sub, redirect: '/sessions' });
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state
    });
    res.json({ url });
  } catch (e:any) {
    res.status(500).json({ message: e.message });
  }
});

// Connection status
router.get('/status', auth('teacher','admin'), async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user.sub).select('googleRefreshToken');
    res.json({ connected: !!user?.googleRefreshToken });
  } catch (e:any) {
    res.status(500).json({ message: 'Failed to get status' });
  }
});

// Public OAuth callback (Google cannot send our auth header)
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return res.status(400).send('Missing code/state');
    const decoded = decodeGoogleState(state);
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      return res.status(400).send('No refresh token returned; revoke previous access and retry');
    }
    await User.findByIdAndUpdate(decoded.uid, { googleRefreshToken: tokens.refresh_token });
    const redirect = process.env.FRONTEND_URL || 'http://localhost:8080';
    return res.redirect(`${redirect}${decoded.redirect || '/sessions'}?google=connected`);
  } catch (e:any) {
    console.error('OAuth callback error', e);
    res.status(500).send('OAuth error');
  }
});

export default router;
