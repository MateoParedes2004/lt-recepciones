import { deviceFromUserAgent, isBotUserAgent } from './user-agent';

const CHROME_PC =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const INSTAGRAM_APP = `${IPHONE} Instagram 340.0.0.22.109`;

describe('isBotUserAgent', () => {
  it.each([CHROME_PC, ANDROID, IPHONE, INSTAGRAM_APP])(
    'una persona no es robot',
    (ua) => {
      expect(isBotUserAgent(ua)).toBe(false);
    },
  );

  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'WhatsApp/2.23.20.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0 Safari/537.36',
    'curl/8.4.0',
    'node-fetch/1.0',
  ])('detecta robots: %s', (ua) => {
    expect(isBotUserAgent(ua)).toBe(true);
  });

  it('sin user-agent cuenta como robot', () => {
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent('')).toBe(true);
  });
});

describe('deviceFromUserAgent', () => {
  it('clasifica el dispositivo', () => {
    expect(deviceFromUserAgent(CHROME_PC)).toBe('computadora');
    expect(deviceFromUserAgent(ANDROID)).toBe('celular');
    expect(deviceFromUserAgent(IPHONE)).toBe('celular');
    expect(deviceFromUserAgent(IPAD)).toBe('tablet');
    expect(deviceFromUserAgent(ANDROID_TABLET)).toBe('tablet');
  });
});
