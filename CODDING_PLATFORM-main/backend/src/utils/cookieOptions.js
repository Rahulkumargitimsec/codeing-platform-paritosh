// In production (Vercel frontend -> Render backend) the cookie must be
// cross-site: secure + sameSite "none". On localhost (plain http) that
// combination is rejected by some browsers, so use "lax" without secure.
const isProd = process.env.NODE_ENV === 'production';

const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 60 * 60 * 1000,
};

module.exports = cookieOptions;
