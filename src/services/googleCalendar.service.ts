import { google } from 'googleapis';

const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT;
if (!REDIRECT_URI) {
  // Warn early if env not loaded
  console.error('[GoogleOAuth] Missing GOOGLE_OAUTH_REDIRECT environment variable');
}

export function getOAuthClient() {
  // Extra debug (remove in production)
  if (!process.env.GOOGLE_CLIENT_ID) console.error('[GoogleOAuth] Missing GOOGLE_CLIENT_ID');
  if (!process.env.GOOGLE_CLIENT_SECRET) console.error('[GoogleOAuth] Missing GOOGLE_CLIENT_SECRET');
  if (!process.env.GOOGLE_OAUTH_REDIRECT) console.error('[GoogleOAuth] Missing GOOGLE_OAUTH_REDIRECT at getOAuthClient call');
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT
  );
}

export async function createMeetEvent(opts: {
  refreshToken: string;
  summary: string;
  description?: string;
  start: Date;
  durationMinutes: number;
}) {
  const auth = getOAuthClient();
  auth.setCredentials({ refresh_token: opts.refreshToken });

  const calendar = google.calendar({ version: 'v3', auth });
  const end = new Date(opts.start.getTime() + opts.durationMinutes * 60000);

  const event = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary: opts.summary,
      description: opts.description,
      start: { dateTime: opts.start.toISOString() },
      end: { dateTime: end.toISOString() },
      conferenceData: {
        createRequest: {
          requestId: 'meet-' + Date.now(),
          conferenceSolutionKey: { type: 'hangoutsMeet' }
        }
      }
    }
  });

  const entryPoint = event.data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video');

  return {
    eventId: event.data.id!,
    meetUrl: entryPoint?.uri || ''
  };
}
