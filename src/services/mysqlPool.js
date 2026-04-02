const mysql = require('mysql2/promise');

function createPool() {
    const user = process.env.MYSQL_USER;
    if (!user) return null;
    return mysql.createPool({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number(process.env.MYSQL_PORT) || 3306,
        user,
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'mydb',
        waitForConnections: true,
        connectionLimit: 5,
    });
}

let pool;
function getPool() {
    if (!pool) pool = createPool();
    return pool;
}

module.exports = { getPool };
