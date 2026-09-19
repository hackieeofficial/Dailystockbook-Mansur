const https = require('https');

const SUPABASE_URL = 'https://ychujsizhftdcrxmeres.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljaHVqc2l6aGZ0ZGNyeG1lcmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NDY4ODYsImV4cCI6MjEwNDUyMjg4Nn0.bYkSxNdN2RFbBCVGsZqmjoPVkgBhxt5MoF-Nw0DvXUs';

console.log('Testing Supabase REST endpoint...');

const url = new URL(`${SUPABASE_URL}/rest/v1/`);
const options = {
    headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
};

https.get(url, options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status code:', res.statusCode);
        console.log('Response headers:', res.headers['content-type']);
        console.log('Response sample:', data.substring(0, 200));
        if (res.statusCode === 200) {
            console.log('✔ Supabase connection SUCCESSFUL!');
        } else {
            console.log('Status not 200:', res.statusCode);
        }
    });
}).on('error', (err) => {
    console.error('Error connecting to Supabase:', err.message);
});
