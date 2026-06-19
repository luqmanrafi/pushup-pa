import time

class RepFSM:
    def __init__(self):
        self.state = 'UP'
        self.reps = 0
        self.target = 15
        self.set_type = 'standard'
        self.target_array = [15, 15, 15]
        self.current_set_index = 0
        self.is_resting = False
        self.last_state_change_time = time.time()
        self.feedback = "Siap dimulai!"
        self.up_y_center = None
        self.incomplete_reps = 0   # Hitung siklus yang tidak terpenuhi

    def calculate_targets(self, base_target, set_type):
        if set_type == 'standard':
            return [base_target, base_target, base_target]
        elif set_type == 'pyramid':
            return [base_target, max(base_target - 2, 1), max(base_target - 4, 1), max(base_target - 6, 1)]
        elif set_type == 'drop':
            return [base_target, max(base_target - 3, 1), max(base_target - 6, 1)]
        return [base_target]

    def reset(self, target=15, set_type='standard'):
        self.state = 'UP'
        self.reps = 0
        self.target = target
        self.set_type = set_type
        self.target_array = self.calculate_targets(target, set_type)
        self.current_set_index = 0
        self.is_resting = False
        self.last_state_change_time = time.time()
        self.feedback = "Siap dimulai!"
        self.up_y_center = None
        self.incomplete_reps = 0

    def next_set(self):
        if self.current_set_index < len(self.target_array) - 1:
            self.current_set_index += 1
            self.reps = 0
            self.state = 'UP'
            self.is_resting = False
            self.feedback = f"Set {self.current_set_index + 1} dimulai!"
            self.target = self.target_array[self.current_set_index]
            self.last_state_change_time = time.time()
        else:
            self.feedback = "Latihan Selesai! 🎉"

    def get_status_dict(self):
        return {
            'reps': self.reps,
            'state': self.state,
            'target': self.target,
            'feedback': self.feedback,
            'is_resting': self.is_resting,
            'current_set_index': self.current_set_index,
            'target_array': self.target_array,
            'incomplete_reps': self.incomplete_reps
        }

    def update(self, detected_class, y_center, box_height, current_timestamp=None):
        if self.is_resting:
            return self.get_status_dict()
            
        if current_timestamp is not None:
            current_time = current_timestamp
        else:
            current_time = time.time()
            
        time_in_state = current_time - self.last_state_change_time
        
        if self.state == 'UP':
            self.up_y_center = y_center
            if detected_class == 'in_between' or detected_class == 'down':
                self.state = 'GOING_DOWN'
                self.last_state_change_time = current_time
                self.feedback = "Turun perlahan..."

        elif self.state == 'GOING_DOWN':
            if detected_class == 'down':
                # Berhasil mencapai posisi DOWN — siklus berjalan benar
                self.feedback = "Tahan..."
                self.state = 'DOWN'
                self.last_state_change_time = current_time
            elif detected_class == 'up':
                # Kembali ke UP tanpa melewati DOWN — siklus tidak lengkap
                self.incomplete_reps += 1
                self.feedback = "⚠️ Gerakan tidak lengkap!"
                self.state = 'UP'
                self.last_state_change_time = current_time

        elif self.state == 'DOWN':
            if detected_class == 'in_between' or detected_class == 'up':
                self.state = 'GOING_UP'
                self.last_state_change_time = current_time

        elif self.state == 'GOING_UP':
            if detected_class == 'up':
                # Berhasil mencapai posisi UP — satu rep dihitung
                self.reps += 1
                if self.reps >= self.target:
                    self.is_resting = True
                    if self.current_set_index < len(self.target_array) - 1:
                        self.feedback = "🎉 Set Selesai! Istirahat dulu."
                    else:
                        self.feedback = "🏆 Latihan Selesai! Luar Biasa!"
                elif "⚠️" not in self.feedback:
                    self.feedback = "✅ Sempurna!"
                self.state = 'UP'
                self.last_state_change_time = current_time
            elif detected_class == 'down':
                # Kembali ke DOWN tanpa mencapai UP — siklus tidak selesai
                self.incomplete_reps += 1
                self.feedback = "⚠️ Gerakan tidak selesai!"
                self.state = 'DOWN'
                self.last_state_change_time = current_time
        
        return self.get_status_dict()
