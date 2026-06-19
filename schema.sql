CREATE DATABASE IF NOT EXISTS repcount_db CHARACTER SET utf8mb4;
USE repcount_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workout_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tanggal_latihan DATE NOT NULL,
    waktu_mulai DATETIME NOT NULL,
    waktu_selesai DATETIME DEFAULT NULL,
    tipe_set VARCHAR(20) NOT NULL DEFAULT 'standard',
    target_repetisi INT NOT NULL DEFAULT 15,
    jumlah_set_dicapai INT DEFAULT 0,
    total_reps_dicapai INT DEFAULT 0,
    gerakan_salah INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
