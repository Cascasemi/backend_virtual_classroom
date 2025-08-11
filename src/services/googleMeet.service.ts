import crypto from 'crypto';

export interface GoogleMeetSession {
  meetingId: string;
  meetingUrl: string;
}

export interface CreateMeetingParams {
  title: string;
  startTime: string;
  duration: number;
}

export function createGoogleMeetSession(params: CreateMeetingParams): GoogleMeetSession {
  // Generate a custom meeting ID in Google Meet format
  const meetingId = generateMeetingId();
  
  return {
    meetingId,
    meetingUrl: `https://meet.google.com/${meetingId}`
  };
}

function generateMeetingId(): string {
  // Generate a Meet-style ID (xxx-xxxx-xxx format)
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  
  // First segment: 3 characters
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  
  // Second segment: 4 characters
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  
  // Third segment: 3 characters
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

// Alternative function for generating room codes
export function generateSimpleMeetingCode(): string {
  // Generate a 10-character code
  return crypto.randomBytes(5).toString('hex');
}

// For future Calendar API integration
export function getGoogleMeetEmbedUrl(meetingId: string): string {
  return `https://meet.google.com/${meetingId}?embedded=true`;
}
