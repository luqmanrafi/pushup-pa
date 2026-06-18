import os
import cv2
import numpy as np
import base64
import uuid
from flask import Flask, request, jsonify, render_template, send_from_directory
from ultralytics import YOLO
from fsm import RepFSM

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

model = YOLO('best.pt')

fsm = RepFSM()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/set_target', methods=['POST'])
def set_target():
    data = request.json or {}
    target = data.get('target', 15)
    set_type = data.get('set_type', 'standard')
    try:
        target = int(target)
    except ValueError:
        target = 15
    fsm.reset(target, set_type)
    return jsonify({'message': 'Target set', 'target': target, 'set_type': set_type})

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
            'confidence': 0.0,
            'message': 'No class detected',
            'image': None
        }
        
        if len(results) > 0:
            result = results[0]
            
            annotated_frame = img.copy()
            
            if result.boxes is not None and len(result.boxes.cls) > 0:
                max_conf_idx = result.boxes.conf.argmax()
                detected_class_idx = int(result.boxes.cls[max_conf_idx].item())
                confidence = float(result.boxes.conf[max_conf_idx].item())
                
                class_names = {0: 'down', 1: 'in_between', 2: 'up'}
                detected_class = class_names.get(detected_class_idx, 'unknown')
                
                xyxy = result.boxes.xyxy[max_conf_idx]
                x1, y1, x2, y2 = int(xyxy[0].item()), int(xyxy[1].item()), int(xyxy[2].item()), int(xyxy[3].item())
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                label = f"{detected_class.upper()} {confidence:.2f}"
                cv2.putText(annotated_frame, label, (x1, max(10, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                
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
                    response['confidence'] = round(confidence, 2)
                    response['message'] = 'Success'
                else:
                    response['message'] = 'Confidence too low (< 0.7)'
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
            
            results = model(frame)
            if len(results) > 0:
                result = results[0]
                annotated_frame = frame.copy()
                
                if result.boxes is not None and len(result.boxes.cls) > 0:
                    max_conf_idx = result.boxes.conf.argmax()
                    detected_class_idx = int(result.boxes.cls[max_conf_idx].item())
                    confidence = float(result.boxes.conf[max_conf_idx].item())
                    
                    class_names = {0: 'down', 1: 'in_between', 2: 'up'}
                    detected_class = class_names.get(detected_class_idx, 'unknown')
                    
                    xyxy = result.boxes.xyxy[max_conf_idx]
                    x1, y1, x2, y2 = int(xyxy[0].item()), int(xyxy[1].item()), int(xyxy[2].item()), int(xyxy[3].item())
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    
                    label = f"{detected_class.upper()} {confidence:.2f}"
                    cv2.putText(annotated_frame, label, (x1, max(10, y1 - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                    
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
