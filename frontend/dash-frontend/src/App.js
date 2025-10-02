import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';

const MetricsDashboard = () => {
  const [metrics, setMetrics] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await axios.get('/api/health');
        if (Array.isArray(res.data)) {
          // Сортируем по времени (по возрастанию)
          const sortedData = res.data.slice().sort((a, b) => new Date(a.time) - new Date(b.time));
          setMetrics(sortedData);
          setError('');
        } else {
          setError('Error: API did not return an array of metrics');
          setMetrics([]);
        }
      } catch (err) {
        setError(`Error fetching metrics: ${err.message}`);
        setMetrics([]);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ margin: '20px' }}>
      <h2>HealthDash: Server Metrics Dashboard</h2>
      {error && <div style={{color: 'red', marginBottom: '10px'}}>{error}</div>}

      {metrics.length > 0 ? (
        <LineChart width={900} height={350} data={metrics} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <XAxis
            dataKey="time"
            tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString()}
            minTickGap={20}
          />
          <YAxis domain={[0, 100]} />
          <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} />
          <Legend verticalAlign="top" height={36} />
          <CartesianGrid strokeDasharray="3 3" />
          <Line type="monotone" dataKey="cpu" stroke="#8884d8" name="CPU %" dot={false} />
          <Line type="monotone" dataKey="mem" stroke="#82ca9d" name="Memory %" dot={false} />
          <Line type="monotone" dataKey="disk" stroke="#ffc658" name="Disk %" dot={false} />
        </LineChart>
      ) : (
        <div>No metrics data to display yet</div>
      )}
    </div>
  );
};

export default MetricsDashboard;

