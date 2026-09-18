export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    try {
        // Get client IP from Vercel headers
        const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
            req.headers['x-real-ip'];
        console.log('Detecting geolocation for IP:', ip);
        // Fetch geolocation data
        const apiUrl = ip ? `https://freeipapi.com/api/json/${ip}` : 'https://freeipapi.com/api/json';
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Geolocation API returned ${response.status}`);
        }
        const data = await response.json();
        console.log('Detected country:', data.countryCode);
        return res.status(200).json(data);
    }
    catch (error) {
        console.error('Geolocation error:', error);
        // Default fallback to Malaysia
        return res.status(200).json({
            countryCode: 'MY',
            countryName: 'Malaysia'
        });
    }
}
