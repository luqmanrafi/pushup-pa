import os
import cv2
import numpy as np
import datetime
import base64
import uuid
from flask import Flask, request, jsonify, render_template, send_from_directory, session
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from dotenv import load_dotenv
from ultralytics import YOLO
from fsm import RepFSM
from database import get_db_connection

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'default_secret_key')
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

model = YOLO('best.pt')
pose_model = YOLO('yolov8n-pose.pt')
# model.to('cuda')
# pose_model.to('cuda')

# Koneksi antar keypoint COCO 17-titik untuk menggambar skeleton
SKELETON_CONNECTIONS = [
    # Kepala — semua koneksi dihapus, tidak ditampilkan
    (5, 6),                              # Bahu
    (5, 7), (7, 9),                      # Lengan kiri
    (6, 8), (8, 10),                     # Lengan kanan
    (5, 11), (6, 12),                    # Torso
    (11, 12),                            # Pinggul
    (11, 13), (13, 15),                  # Kaki kiri
    (12, 14), (14, 16),                  # Kaki kanan
]

# Keypoint yang tidak ditampilkan (kepala tidak relevan untuk push-up)
SKIP_KEYPOINTS = {0, 1, 2, 3, 4}  # hidung, mata, telinga

# Warna keypoint per bagian tubuh
KEYPOINT_COLORS = [
    (255, 255, 0),   # 0  - hidung
    (255, 200, 0),   # 1  - mata kiri
    (255, 200, 0),   # 2  - mata kanan
    (255, 150, 0),   # 3  - telinga kiri
    (255, 150, 0),   # 4  - telinga kanan
    (0, 255, 100),   # 5  - bahu kiri
    (0, 255, 100),   # 6  - bahu kanan
    (0, 200, 255),   # 7  - siku kiri
    (0, 200, 255),   # 8  - siku kanan
    (0, 100, 255),   # 9  - pergelangan kiri
    (0, 100, 255),   # 10 - pergelangan kanan
    (200, 0, 255),   # 11 - pinggul kiri
    (200, 0, 255),   # 12 - pinggul kanan
    (150, 0, 200),   # 13 - lutut kiri
    (150, 0, 200),   # 14 - lutut kanan
    (100, 0, 150),   # 15 - pergelangan kaki kiri
    (100, 0, 150),   # 16 - pergelangan kaki kanan
]

def draw_skeleton(frame, keypoints, conf_threshold=0.5):
    """
    Menggambar skeleton (keypoint + garis koneksi) dari hasil model pose.
    Hanya keypoint dengan confidence di atas threshold yang ditampilkan.
    """
    if keypoints is None or len(keypoints) == 0:
        return frame

    for person_kp in keypoints:
        kp_xy   = person_kp.xy[0]    # shape [17, 2]
        kp_conf = person_kp.conf[0]  # shape [17]

        # Gambar garis koneksi lebih dulu (agar titik di atas garis)
        for (p1_idx, p2_idx) in SKELETON_CONNECTIONS:
            c1 = float(kp_conf[p1_idx])
            c2 = float(kp_conf[p2_idx])
            if c1 > conf_threshold and c2 > conf_threshold:
                x1, y1 = int(kp_xy[p1_idx][0]), int(kp_xy[p1_idx][1])
                x2, y2 = int(kp_xy[p2_idx][0]), int(kp_xy[p2_idx][1])
                if x1 > 0 and y1 > 0 and x2 > 0 and y2 > 0:
                    cv2.line(frame, (x1, y1), (x2, y2), (0, 220, 255), 2, cv2.LINE_AA)

        # Gambar titik keypoint (skip mata & telinga)
        for i, (x, y) in enumerate(kp_xy):
            if i in SKIP_KEYPOINTS:
                continue
            conf = float(kp_conf[i])
            if conf > conf_threshold and x > 0 and y > 0:
                color = KEYPOINT_COLORS[i] if i < len(KEYPOINT_COLORS) else (255, 255, 255)
                cv2.circle(frame, (int(x), int(y)), 5, color, -1, cv2.LINE_AA)
                cv2.circle(frame, (int(x), int(y)), 6, (255, 255, 255), 1, cv2.LINE_AA)  # Outline putih

    return frame

fsm = RepFSM()

@app.route('/')
def index():
    return render_template('index.html')

# ==========================================
# AUTHENTICATION ROUTES
# ==========================================

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not email or not password:
        return jsonify({'error': 'Username, email, dan password harus diisi'}), 400

    hashed_password = generate_password_hash(password)
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database tidak terhubung'}), 500

    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (username, email, password) VALUES (%s, %s, %s)", (username, email, hashed_password))
        conn.commit()
        return jsonify({'message': 'Registrasi berhasil!'})
    except mysql.connector.Error as err:
        if err.errno == 1062: # Duplicate entry
            # Check which field is duplicated
            if 'email' in str(err):
                return jsonify({'error': 'Email sudah terpakai'}), 400
            else:
                return jsonify({'error': 'Username sudah terpakai'}), 400
        return jsonify({'error': str(err)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database tidak terhubung'}), 500

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'message': 'Login berhasil', 'username': user['username']})
    
    return jsonify({'error': 'Username atau password salah'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logout berhasil'})

@app.route('/check_auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        return jsonify({'is_authenticated': True, 'username': session['username']})
    return jsonify({'is_authenticated': False})

# ==========================================
# WORKOUT SESSION ROUTES
# ==========================================

@app.route('/start_session', methods=['POST'])
def start_session():
    if 'user_id' not in session:
        return jsonify({'error': 'Harus login terlebih dahulu'}), 401

    data = request.json
    target = data.get('target', 15)
    set_type = data.get('set_type', 'standard')
    
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database tidak terhubung'}), 500

    waktu_mulai = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    tanggal_latihan = datetime.datetime.now().strftime('%Y-%m-%d')
    user_id = session['user_id']

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO workout_sessions 
        (user_id, tanggal_latihan, waktu_mulai, tipe_set, target_repetisi) 
        VALUES (%s, %s, %s, %s, %s)
    """, (user_id, tanggal_latihan, waktu_mulai, set_type, target))
    
    conn.commit()
    session_id = cursor.lastrowid
    cursor.close()
    conn.close()

    # Reset FSM
    try:
        target = int(target)
    except ValueError:
        target = 15
    fsm.reset(target, set_type)

    return jsonify({
        'message': 'Sesi dimulai', 
        'session_id': session_id,
        'target': target,
        'set_type': set_type
    })

@app.route('/end_session', methods=['POST'])
def end_session():
    if 'user_id' not in session:
        return jsonify({'error': 'Harus login terlebih dahulu'}), 401

    data = request.json
    session_id = data.get('session_id')
    total_reps = data.get('total_reps', 0)
    sets_completed = data.get('sets_completed', 0)
    incomplete_reps = data.get('incomplete_reps', 0)
    
    if not session_id:
        return jsonify({'error': 'Session ID tidak diberikan'}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database tidak terhubung'}), 500

    waktu_selesai = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    user_id = session['user_id']

    cursor = conn.cursor()
    # Pastikan sesi milik user yang bersangkutan
    if total_reps == 0 and incomplete_reps == 0:
        # Jika tidak ada gerakan yang dicapai sama sekali, hapus record (sesi batal)
        cursor.execute("DELETE FROM workout_sessions WHERE id = %s AND user_id = %s", (session_id, user_id))
    else:
        cursor.execute("""
            UPDATE workout_sessions 
            SET waktu_selesai = %s, total_reps_dicapai = %s, jumlah_set_dicapai = %s, gerakan_salah = %s
            WHERE id = %s AND user_id = %s
        """, (waktu_selesai, total_reps, sets_completed, incomplete_reps, session_id, user_id))
    
    conn.commit()
    rows_affected = cursor.rowcount
    cursor.close()
    conn.close()

    if rows_affected == 0:
        return jsonify({'error': 'Sesi tidak ditemukan atau tidak ada akses'}), 404

    return jsonify({'message': 'Sesi diakhiri dan disimpan'})

@app.route('/get_history', methods=['GET'])
def get_history():
    if 'user_id' not in session:
        return jsonify({'error': 'Harus login terlebih dahulu'}), 401

    user_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        return jsonify({'error': 'Database tidak terhubung'}), 500

    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT * FROM workout_sessions 
        WHERE user_id = %s AND waktu_selesai IS NOT NULL
        ORDER BY waktu_selesai DESC LIMIT 50
    """, (user_id,))
    
    history = cursor.fetchall()
    cursor.close()
    conn.close()

    # Format data agar sesuai dengan format frontend
    formatted_history = []
    for row in history:
        # Hitung durasi
        waktu_mulai = row['waktu_mulai']
        waktu_selesai = row['waktu_selesai']
        durasi = int((waktu_selesai - waktu_mulai).total_seconds()) if waktu_mulai and waktu_selesai else 0
        
        formatted_history.append({
            'id': row['id'],
            'date': row['waktu_selesai'].isoformat(),
            'setType': row['tipe_set'],
            'target': row['target_repetisi'],
            'totalReps': row['total_reps_dicapai'],
            'setsCompleted': row['jumlah_set_dicapai'],
            'incompleteReps': row['gerakan_salah'],
            'durationSeconds': durasi
        })

    return jsonify(formatted_history)

# ==========================================
# OLD ROUTES (Modifikasi sebagian)
# ==========================================

# endpoint set_target diganti oleh start_session
# @app.route('/set_target', methods=['POST']) dihapus

@app.route('/next_set', methods=['POST'])
def next_set():
    fsm.next_set()
    return jsonify({'message': 'Next set started'})

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
        
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file:
        img_bytes = file.read()
        npimg = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)
        
        results = model(img)
        
        response = {
            'yolo_class': 'UNKNOWN',
            'fsm_state': fsm.state,
            'reps': fsm.reps,
            'target': fsm.target,
            'feedback': fsm.feedback,
            'is_resting': fsm.is_resting,
            'current_set_index': fsm.current_set_index,
            'target_array': fsm.target_array,
            'incomplete_reps': fsm.incomplete_reps,
            'confidence': 0.0,
            'message': 'No class detected',
            'image': None
        }
        
        if len(results) > 0:
            result = results[0]
            
            annotated_frame = img.copy()

            # --- Gambar skeleton dari model pose ---
            pose_results = pose_model(img, verbose=False)
            if len(pose_results) > 0 and pose_results[0].keypoints is not None:
                draw_skeleton(annotated_frame, pose_results[0].keypoints)
            
            if result.boxes is not None and len(result.boxes.cls) > 0:
                valid_indices = [i for i, cls in enumerate(result.boxes.cls) if int(cls.item()) in [0, 1, 2]]
                if len(valid_indices) > 0:
                    max_conf_idx = max(valid_indices, key=lambda i: result.boxes.conf[i].item())
                    detected_class_idx = int(result.boxes.cls[max_conf_idx].item())
                    confidence = float(result.boxes.conf[max_conf_idx].item())
                    
                    class_names = {0: 'down', 1: 'in_between', 2: 'up'}
                    detected_class = class_names[detected_class_idx]
                    
                    # Warna bounding box per kelas
                    box_colors = {'down': (0, 0, 255), 'in_between': (0, 255, 255), 'up': (0, 255, 0)}
                    box_color = box_colors.get(detected_class, (0, 255, 0))

                    xyxy = result.boxes.xyxy[max_conf_idx]
                    x1, y1, x2, y2 = int(xyxy[0].item()), int(xyxy[1].item()), int(xyxy[2].item()), int(xyxy[3].item())
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), box_color, 2)
                    
                    label = f"{detected_class.upper()} {confidence:.2f}"
                    cv2.putText(annotated_frame, label, (x1, max(10, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)
                    
                    xywh = result.boxes.xywh[max_conf_idx]
                    y_center = float(xywh[1].item())
                    box_height = float(xywh[3].item())
                    
                    if confidence > 0.7:
                        status = fsm.update(detected_class, y_center, box_height)
                        response['yolo_class'] = detected_class.upper()
                        response['fsm_state'] = status['state']
                        response['reps'] = status['reps']
                        response['target'] = status['target']
                        response['feedback'] = status['feedback']
                        response['is_resting'] = status['is_resting']
                        response['current_set_index'] = status['current_set_index']
                        response['target_array'] = status['target_array']
                        response['incomplete_reps'] = status['incomplete_reps']
                        response['confidence'] = round(confidence, 2)
                        response['message'] = 'Success'
                    else:
                        response['message'] = 'Confidence too low (< 0.7)'
                else:
                    response['message'] = 'No valid class detected'
            else:
                response['message'] = 'No box detected in image'
                
            _, buffer = cv2.imencode('.jpg', annotated_frame)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            response['image'] = img_base64
                
        return jsonify(response)

@app.route('/uploads/<filename>')
def serve_video(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/analyze_video', methods=['POST'])
def analyze_video():
    if 'video' not in request.files:
        return jsonify({'error': 'No video provided'}), 400
        
    file = request.files['video']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
        
    if file:
        input_filename = str(uuid.uuid4()) + '_' + file.filename
        input_path = os.path.join(UPLOAD_FOLDER, input_filename)
        file.save(input_path)
        
        target = request.form.get('target', 15)
        set_type = request.form.get('set_type', 'standard')
        try:
            target = int(target)
        except ValueError:
            target = 15
        fsm.reset(target, set_type)
        
        cap = cv2.VideoCapture(input_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        output_filename = 'out_' + str(uuid.uuid4()) + '.webm'
        output_path = os.path.join(UPLOAD_FOLDER, output_filename)
        fourcc = cv2.VideoWriter_fourcc(*'vp80')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            current_timestamp = frame_idx / fps
            
            results = model(frame, verbose=False)
            if len(results) > 0:
                result = results[0]
                annotated_frame = frame.copy()

                # --- Gambar skeleton dari model pose ---
                pose_results = pose_model(frame, verbose=False)
                if len(pose_results) > 0 and pose_results[0].keypoints is not None:
                    draw_skeleton(annotated_frame, pose_results[0].keypoints)
                
                if result.boxes is not None and len(result.boxes.cls) > 0:
                    valid_indices = [i for i, cls in enumerate(result.boxes.cls) if int(cls.item()) in [0, 1, 2]]
                    if len(valid_indices) > 0:
                        max_conf_idx = max(valid_indices, key=lambda i: result.boxes.conf[i].item())
                        detected_class_idx = int(result.boxes.cls[max_conf_idx].item())
                        confidence = float(result.boxes.conf[max_conf_idx].item())
                        
                        class_names = {0: 'down', 1: 'in_between', 2: 'up'}
                        detected_class = class_names[detected_class_idx]

                        # Warna bounding box per kelas
                        box_colors = {'down': (0, 0, 255), 'in_between': (0, 255, 255), 'up': (0, 255, 0)}
                        box_color = box_colors.get(detected_class, (0, 255, 0))
                        
                        xyxy = result.boxes.xyxy[max_conf_idx]
                        x1, y1, x2, y2 = int(xyxy[0].item()), int(xyxy[1].item()), int(xyxy[2].item()), int(xyxy[3].item())
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), box_color, 2)
                        
                        label = f"{detected_class.upper()} {confidence:.2f}"
                        cv2.putText(annotated_frame, label, (x1, max(10, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)
                        
                        xywh = result.boxes.xywh[max_conf_idx]
                        y_center = float(xywh[1].item())
                        box_height = float(xywh[3].item())
                        
                        if confidence > 0.7:
                            status = fsm.update(detected_class, y_center, box_height, current_timestamp)
                            
                            cv2.putText(annotated_frame, f"State: {status['state']}", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
                            cv2.putText(annotated_frame, f"Reps: {status['reps']}/{status['target']} (Set {status['current_set_index']+1})", (30, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                            
                            color = (255, 255, 255)
                            if "⚠️" in status['feedback']:
                                color = (0, 0, 255)
                            elif "✅" in status['feedback'] or "🎉" in status['feedback'] or "🏆" in status['feedback']:
                                color = (0, 255, 0)
                                
                            feedback_text = status['feedback'].replace("⚠️", "").replace("✅", "").replace("🎉", "").replace("🏆", "").strip()
                            cv2.putText(annotated_frame, feedback_text, (30, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
                
                out.write(annotated_frame)
            else:
                out.write(frame)
                
            frame_idx += 1
            
        cap.release()
        out.release()
        
        # Cleanup input to save space
        if os.path.exists(input_path):
            os.remove(input_path)
            
        video_url = f"/uploads/{output_filename}"
        return jsonify({'message': 'Success', 'video_url': video_url})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
