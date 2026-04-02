const { createApp } = require('./src/app');
const config = require('./src/config');

const app = createApp();

app.listen(config.port, '0.0.0.0', () => {
    console.log(`listening on 0.0.0.0:${config.port}`);
});
