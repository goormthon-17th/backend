-- 기존 DB가 email 컬럼을 쓰는 경우에만 수동 실행 (새 init.sql이면 불필요)
ALTER TABLE `user` DROP INDEX uq_user_email;
ALTER TABLE `user` CHANGE COLUMN email login_id VARCHAR(255) NOT NULL;
ALTER TABLE `user` ADD UNIQUE KEY uq_user_login_id (login_id);
