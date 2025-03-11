import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";
import "./index.css";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
} from "chart.js";

// Register the required components for Chart.js
ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Legend, Tooltip);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);

  // New states for device claiming and sensor reading
  const [deviceId, setDeviceId] = useState("");
  const [deviceKey, setDeviceKey] = useState("");
  const [claimedDevices, setClaimedDevices] = useState([]);
  const [sensorData, setSensorData] = useState([]);

  // Authentication handler (register or login)
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (registering) {
        await axios.post("https://bernt.xyz/api/register", {
          email,
          password,
        });
        alert("User registered successfully! Now log in.");
        setRegistering(false);
      } else {
        const res = await axios.post(
          "https://bernt.xyz/api/token",
          new URLSearchParams({
            username: email,
            password: password,
          })
        );
        setToken(res.data.access_token);
        localStorage.setItem("token", res.data.access_token);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Authentication failed");
    }
  };

  // Fetch the user's claimed devices
  const fetchDevices = async () => {
    try {
      const res = await axios.get("https://bernt.xyz/api/devices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClaimedDevices(res.data);
    } catch (err) {
      console.error("Error fetching devices", err);
    }
  };

  // Claim a device (requires both device_id and device_key)
  const claimDevice = async () => {
    try {
      await axios.post(
        "https://bernt.xyz/api/claim",
        { device_id: deviceId, device_key: deviceKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Device claimed successfully!");
      setDeviceId("");
      setDeviceKey("");
      fetchDevices();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to claim device");
    }
  };

  // Unclaim a device by its device_id
  const unclaimDevice = async (id) => {
    try {
      await axios.delete(`https://bernt.xyz/api/unclaim/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Device unclaimed successfully!");
      fetchDevices();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to unclaim device");
    }
  };

  // Fetch sensor data (latest readings)
  const fetchSensorData = async () => {
    try {
      const res = await axios.get("https://bernt.xyz/api/sensor_data", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSensorData(res.data);
    } catch (err) {
      console.error("Error fetching sensor data", err);
    }
  };

  // When logged in, fetch devices and sensor data
  useEffect(() => {
    if (token) {
      fetchDevices();
      fetchSensorData();
      // Optionally refresh sensor data every minute
      const interval = setInterval(fetchSensorData, 60000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Determine the latest sensor reading (if available)
  const latestReading = sensorData.length > 0 ? sensorData[0] : null;

  // Prepare chart data using the last 50 readings.
  // If the data is sorted descending (latest first), we reverse it for chronological order.
  const last50Readings = sensorData.slice(0, 200).reverse();
  const labels = last50Readings.map((reading) =>
    reading.timestamp.substring(11, 19)
  ); // Format: HH:MM:SS

  const voltageCurrentData = {
    labels: labels,
    datasets: [
      {
        label: "Voltage (V)",
        data: last50Readings.map((reading) => reading.voltage),
        borderColor: "rgba(75,192,192,1)",
        fill: false,
      },
      {
        label: "Current (A)",
        data: last50Readings.map((reading) => reading.current),
        borderColor: "rgba(153,102,255,1)",
        fill: false,
      },
    ],
  };

  const wattsChartData = {
    labels: labels,
    datasets: [
      {
        label: "Watts (W)",
        data: last50Readings.map((reading) => reading.watts),
        borderColor: "rgba(255,159,64,1)",
        fill: false,
      },
    ],
  };

  useEffect(() => {
    // Add an interceptor to handle 401 errors
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Token is expired or invalid, clear it and update state
          localStorage.removeItem("token");
          setToken("");
          alert("Session expired. Please log in again.");
        }
        return Promise.reject(error);
      }
    );

    // Eject the interceptor when the component unmounts
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  return (
    <div className="page-container">
      {!token ? (
        <form onSubmit={handleAuth} className="card">
          <h2 className="card-title">
            {registering ? "Register" : "Login"}
          </h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-control"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="form-control"
          />
          <button type="submit" className="button btn-primary">
            {registering ? "Register" : "Login"}
          </button>
          <button
            type="button"
            onClick={() => setRegistering(!registering)}
            className="button btn-link"
          >
            {registering
              ? "Already have an account? Login"
              : "Need an account? Register"}
          </button>
        </form>
      ) : (
        <div className="dashboard">
          <h2 className="dashboard-title">B.E.R.N.T</h2>

          {/* Claim Device Form */}
          <div className="card">
            <h3 className="card-title">Claim a Device</h3>
            <input
              type="text"
              placeholder="Device ID"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="form-control"
            />
            <input
              type="text"
              placeholder="Device Key"
              value={deviceKey}
              onChange={(e) => setDeviceKey(e.target.value)}
              className="form-control"
            />
            <button onClick={claimDevice} className="button btn-success">
              Claim Device
            </button>
          </div>

          {/* Display Claimed Devices */}
          <div className="card">
            <h3 className="card-title">Claimed Devices</h3>
            {claimedDevices.length > 0 ? (
              <ul className="device-list">
                {claimedDevices.map((dev) => (
                  <li key={dev} className="device-item">
                    <span>{dev}</span>
                    <button
                      onClick={() => unclaimDevice(dev)}
                      className="button btn-danger"
                    >
                      Unclaim
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No devices claimed.</p>
            )}
          </div>

          {/* Display Latest Sensor Reading */}
          <div className="card">
            <h3 className="card-title">Latest Sensor Reading</h3>
            {latestReading ? (
              <div className="sensor-reading">
                <p>
                  <strong>Device ID:</strong> {latestReading.device_id}
                </p>
                <p>
                  <strong>Timestamp:</strong> {latestReading.timestamp}
                </p>
                <p>
                  <strong>Temperature:</strong> {latestReading.temperature}
                </p>
                <p>
                  <strong>Voltage:</strong> {latestReading.voltage}
                </p>
                <p>
                  <strong>Current:</strong> {latestReading.current}
                </p>
                <p>
                  <strong>Watts:</strong> {latestReading.watts}
                </p>
              </div>
            ) : (
              <p>No sensor data available.</p>
            )}
          </div>

          {/* Display Sensor Data Charts Side by Side */}
          {sensorData.length > 0 && (
            <div className="card">
              <h3 className="card-title">
                Sensor Data Charts (Last 200 Readings)
              </h3>
              <div className="chart-container">
                <div className="chart-item">
                  <h4>Voltage &amp; Current</h4>
                  <Line data={voltageCurrentData} />
                </div>
                <div className="chart-item">
                  <h4>Watts</h4>
                  <Line data={wattsChartData} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
