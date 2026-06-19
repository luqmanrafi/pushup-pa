# RepCount AI - Pose Workout Web App

Aplikasi cerdas berbasis web untuk menghitung repetisi olahraga (Push-Up) secara otomatis dan menganalisis postur tubuh (gerakan benar/salah) menggunakan Computer Vision (YOLOv8). 

Terdapat fitur sistem login pengguna dan pencatatan riwayat latihan (History) dengan MySQL.

## Prasyarat (Requirements)
Sebelum memulai, pastikan perangkat Anda sudah terinstall:
1. **Python** (versi 3.8 atau lebih baru)
2. **MySQL Server** (XAMPP / Laragon / dsb)

---

## 🛠️ Langkah Instalasi

### 1. Clone atau Ekstrak Folder
Pastikan Anda sudah berada di dalam direktori project `web-workout`.

### 2. Konfigurasi Lingkungan Virtual (Opsional Tapi Disarankan)
Sangat disarankan menggunakan virtual environment agar *dependency* Python tidak berantakan.
```bash
python -m venv venv
```
Aktivasi virtual environment:
- **Windows**: `venv\Scripts\activate`
- **Mac/Linux**: `source venv/bin/activate`

### 3. Instalasi Dependensi Python
Di dalam folder project, instal semua *library* yang dibutuhkan dengan cara menjalankan:
```bash
pip install -r requirements.txt
```

*(Library yang akan diinstal meliputi: Flask, Werkzeug, mysql-connector-python, python-dotenv, ultralytics, opencv-python, numpy).*

### 4. Persiapan Database MySQL
1. Nyalakan layanan MySQL Anda (misal dari panel XAMPP atau Laragon).
2. Pastikan port yang digunakan sudah sesuai dengan file `.env` (secara default `3307`). Jika MySQL Anda berjalan di port standar, ubah port di file `.env` menjadi `3306`.
3. Buka shell MySQL atau tool seperti *phpMyAdmin/DBeaver*.
4. *Import* script database dengan cara:
   ```bash
   mysql -u root -P 3307 -e "source schema.sql"
   ```
   Atau Anda bisa *copy-paste* langsung isi dari file `schema.sql` ke *SQL Runner* di phpMyAdmin.

### 5. Konfigurasi File `.env`
Buka file `.env` dan sesuaikan nilainya dengan konfigurasi database di komputer Anda:
```env
DB_HOST=localhost
DB_PORT=3307      # Ubah ke 3306 jika Anda menggunakan port MySQL standar
DB_USER=root      # Username MySQL
DB_PASSWORD=      # Kosongkan jika tidak ada password
DB_NAME=repcount_db
FLASK_SECRET_KEY=repcount_super_secret_key_12345
```

---

## 🚀 Cara Menjalankan Aplikasi

Jika semua persiapan di atas sudah selesai, jalankan server backend Flask:
```bash
python app.py
```

Setelah server menyala (muncul tulisan `Running on http://127.0.0.1:5000`), buka browser Anda dan akses:
👉 **http://localhost:5000**

---

## 💡 Panduan Penggunaan
1. **Registrasi:** Pertama kali masuk, klik "Belum punya akun? Daftar sekarang" di form popup. Masukkan Username, Email, dan Password Anda.
2. **Login:** Masuk dengan akun yang baru saja dibuat.
3. **Mulai Workout:** Tentukan target repetisi (atau tipe set seperti Pyramid/Drop) lalu klik **Start Workout**. Kamera akan menyala.
4. **Akhiri Sesi:** Klik **Akhiri Sesi & Simpan** untuk menyimpan data latihan ke Database. (Catatan: Jika repetisi 0 dan tidak ada gerakan salah, sesi otomatis dibatalkan/dihapus agar tidak mengotori riwayat).
5. **Riwayat (History):** Lihat kemajuan dan riwayat sesi latihan Anda di panel kanan atau dengan mengklik "Lihat Semua" di bagian bawah layar.
