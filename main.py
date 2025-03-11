from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from typing import List
import sqlite3
import bcrypt
import jwt
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import uvicorn

# FastAPI instance
app = FastAPI()

# JWT Secret & Expiry
SECRET_KEY = "your_secret_key"
ALGORITHM = "HS256"
TOKEN_EXPIRY = timedelta(hours=12)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

# connect to iot_databae.db
def get_db():
    conn = sqlite3.connect("/home/ubuntu/sensor-db/iot_database.db")
    conn.row_factory = sqlite3.Row
    return conn

# user register and device register
class UserRegister(BaseModel):
    email: str
    password: str

class DeviceClaim(BaseModel):
    device_id: str
    device_key: str

# Utility Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed_password.encode())

def create_token(user_id: int):
    payload = {"sub": user_id, "exp": datetime.utcnow() + TOKEN_EXPIRY}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print("Decoded Token Payload:", payload)  #debugging
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    user_id = verify_token(token)
    conn = get_db()
    user = conn.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"id": user["id"], "email": user["email"]}

# API register user
@app.post("/register")
def register(user: UserRegister):
    conn = get_db()
    cursor = conn.cursor()
    hashed_pw = hash_password(user.password)
    try:
        cursor.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", (user.email, hashed_pw))
        conn.commit()
        return {"message": "User registered successfully"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Email already exists")
    finally:
        conn.close()
# API register token
@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = get_db()
    user = conn.execute("SELECT id, password_hash FROM users WHERE email = ?", (form_data.username,)).fetchone()
    conn.close()
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    token = create_token(user["id"])
    return {"access_token": token, "token_type": "bearer"}

#API get devices
@app.get("/devices")
def get_claimed_devices(user: dict = Depends(get_current_user)):
    conn = get_db()
    devices = conn.execute("SELECT device_id FROM user_devices WHERE user_id = ?", (user["id"],)).fetchall()
    conn.close()
    return [device["device_id"] for device in devices]

#API post claim a device, by id and key.
@app.post("/claim")
def claim_device(device: DeviceClaim, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    device_check = cursor.execute("SELECT device_id FROM devices WHERE device_id = ? AND device_key = ?", 
                                  (device.device_id, device.device_key)).fetchone()
    if not device_check:
        raise HTTPException(status_code=400, detail="Invalid device ID or key")
    cursor.execute("INSERT INTO user_devices (user_id, device_id) VALUES (?, ?)", (user["id"], device.device_id))
    conn.commit()
    conn.close()
    return {"message": "Device claimed successfully"}


# delete a claimed device
@app.delete("/unclaim/{device_id}")
def unclaim_device(device_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM user_devices WHERE user_id = ? AND device_id = ?", (user["id"], device_id))
    conn.commit()
    conn.close()
    return {"message": "Device unclaimed successfully"}


#get and display sensor data for the device claimed by user.
@app.get("/sensor_data")
def get_sensor_data(user: dict = Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    data = cursor.execute("""
        SELECT s.device_id, s.device_timestamp, s.temperature, s.voltage, s.current, s.watts
        FROM sensor_data s
        JOIN user_devices u ON s.device_id = u.device_id
        WHERE u.user_id = ?
        ORDER BY s.db_timestamp DESC LIMIT 200
    """, (user["id"],)).fetchall()
    conn.close()
    return [{
        "device_id": row["device_id"],
        "timestamp": row["device_timestamp"],
        "temperature": row["temperature"],
        "voltage": row["voltage"],
        "current": row["current"],
        "watts": row["watts"]
    } for row in data]

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
