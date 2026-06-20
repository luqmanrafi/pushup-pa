from database import get_db_connection

conn = get_db_connection()
cursor = conn.cursor()
try:
    cursor.execute("ALTER TABLE workout_sessions ADD COLUMN status VARCHAR(20) DEFAULT 'Tidak Tercapai'")
    conn.commit()
    print("Column 'status' added successfully!")
except Exception as e:
    if 'Duplicate column' in str(e):
        print("Column 'status' already exists, skipping.")
    else:
        raise e
finally:
    cursor.close()
    conn.close()
