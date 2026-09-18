import app from './dist-server/index.js';

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`[PROD] Server is running on port ${port}`);
});
