const { getPool } = require('./mysqlPool');

/** init.sql 과 동일 DDL. MySQL PVC가 이미 있어 entrypoint init이 안 돈 경우에도 테이블 보장 */
const TABLE_DDLS = [
    `CREATE TABLE IF NOT EXISTS \`user\` (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    login_id VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    profile_image_url VARCHAR(2048),
    role ENUM('owner', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_login_id (login_id),
    KEY idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS recipe (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    raw_text TEXT,
    refined_text TEXT,
    image_url VARCHAR(2048),
    like_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_recipe_user (user_id),
    CONSTRAINT fk_recipe_user FOREIGN KEY (user_id) REFERENCES \`user\` (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS recipe_like (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    recipe_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_recipe_like_user_recipe (user_id, recipe_id),
    KEY idx_recipe_like_recipe (recipe_id),
    CONSTRAINT fk_recipe_like_user FOREIGN KEY (user_id) REFERENCES \`user\` (id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_like_recipe FOREIGN KEY (recipe_id) REFERENCES recipe (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS recipe_review (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    recipe_id BIGINT UNSIGNED NOT NULL,
    content TEXT,
    is_liked TINYINT(1) NOT NULL DEFAULT 0,
    emo_1 TINYINT(1) NOT NULL DEFAULT 0,
    emo_2 TINYINT(1) NOT NULL DEFAULT 0,
    emo_3 TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_recipe_review_user_recipe (user_id, recipe_id),
    KEY idx_recipe_review_recipe (recipe_id),
    CONSTRAINT fk_recipe_review_user FOREIGN KEY (user_id) REFERENCES \`user\` (id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_review_recipe FOREIGN KEY (recipe_id) REFERENCES recipe (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS user_subscribe (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    follower_id BIGINT UNSIGNED NOT NULL,
    following_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_subscribe_pair (follower_id, following_id),
    KEY idx_subscribe_following (following_id),
    CONSTRAINT fk_subscribe_follower FOREIGN KEY (follower_id) REFERENCES \`user\` (id) ON DELETE CASCADE,
    CONSTRAINT fk_subscribe_following FOREIGN KEY (following_id) REFERENCES \`user\` (id) ON DELETE CASCADE,
    CONSTRAINT chk_subscribe_not_self CHECK (follower_id <> following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS environment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    gem VARCHAR(8192),
    \`invoke\` VARCHAR(8192),
    secret VARCHAR(8192),
    \`map\` VARCHAR(8192),
    \`back\` VARCHAR(8192),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function ensureSchema() {
    const pool = getPool();
    if (!pool) {
        return;
    }
    for (const sql of TABLE_DDLS) {
        await pool.query(sql);
    }
    try {
        await pool.query('ALTER TABLE recipe DROP COLUMN audio_url');
    } catch (e) {
        const gone = e.errno === 1091 || e.code === 'ER_CANT_DROP_FIELD_OR_KEY';
        if (!gone) {
            throw e;
        }
    }
    try {
        await pool.query('ALTER TABLE recipe ADD COLUMN image_url VARCHAR(2048) NULL AFTER refined_text');
    } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
            throw e;
        }
    }
    try {
        await pool.query(
            'ALTER TABLE `user` ADD COLUMN profile_image_url VARCHAR(2048) NULL AFTER nickname',
        );
    } catch (e) {
        if (e.code !== 'ER_DUP_FIELDNAME' && e.errno !== 1060) {
            throw e;
        }
    }
    // recipe 비로그인 시 user_id=1 FK용 (이미 id=1 있으면 스킵)
    const [existing] = await pool.query('SELECT id FROM `user` WHERE id = 1 LIMIT 1');
    if (!existing.length) {
        await pool.execute(
            'INSERT INTO `user` (id, login_id, password, nickname) VALUES (1, ?, ?, ?)',
            ['__system_uid_1__', '-', 'anonymous'],
        );
    }
}

module.exports = { ensureSchema };
