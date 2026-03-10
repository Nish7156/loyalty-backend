/**
 * Test Fast2SMS SMS API (OTP route or Quick SMS route).
 * Usage: node scripts/test-fast2sms.js [quick|otp] [10-digit-number]
 * Example: node scripts/test-fast2sms.js quick 8419997952
 *          node scripts/test-fast2sms.js 8419997952  (default: quick)
 * Uses FAST2SMS_API_KEY from .env (run from loyalty-backend directory).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const FAST2SMS_URL = 'https://www.fast2sms.com/dev/bulkV2';
const apiKey = process.env.FAST2SMS_API_KEY;
const arg1 = process.argv[2];
const arg2 = process.argv[3];
const isRoute = arg1 === 'quick' || arg1 === 'q' || arg1 === 'otp';
const useQuick = isRoute ? arg1 !== 'otp' : true;
const number = (isRoute ? arg2 : arg1) || '8419997952';
const numOnly = String(number).replace(/\D/g, '');
const finalNumber = numOnly.length > 10 ? numOnly.slice(-10) : numOnly;
const otp = String(Math.floor(1000 + Math.random() * 9000));

if (!apiKey || !apiKey.trim()) {
  console.error('Error: FAST2SMS_API_KEY not set in .env');
  process.exit(1);
}

if (finalNumber.length < 10) {
  console.error('Error: Provide a valid 10-digit Indian number (e.g. 8419997952)');
  process.exit(1);
}

const body = useQuick
  ? { route: 'q', message: `Your OTP: ${otp}`, numbers: finalNumber, flash: '0' }
  : { variables_values: otp, route: 'otp', numbers: finalNumber, flash: '0' };

console.log('Route:', useQuick ? 'Quick SMS (q)' : 'OTP');
console.log('Number:', finalNumber, '| OTP:', otp);

fetch(FAST2SMS_URL, {
  method: 'POST',
  headers: {
    authorization: apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
})
  .then((res) => res.json())
  .then((data) => {
    console.log('\nResponse:', JSON.stringify(data, null, 2));
    if (data.status_code != null && data.status_code !== 200) {
      console.error('\nResult: FAILED -', data.message || `status_code ${data.status_code}`);
      process.exit(1);
    }
    if (data.return === false) {
      console.error('\nResult: FAILED -', Array.isArray(data.message) ? data.message.join('; ') : data.message);
      process.exit(1);
    }
    console.log('\nResult: SUCCESS - SMS should be delivered. Check the phone for OTP:', otp);
  })
  .catch((err) => {
    console.error('\nError:', err.message);
    process.exit(1);
  });
