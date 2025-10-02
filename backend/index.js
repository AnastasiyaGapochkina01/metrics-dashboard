// index.js
const express = require('express');
const amqp = require('amqplib');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const app = express();
const port = 3000;

const influxConfig = {
  url: 'http://localhost:8086',
  token: 'admintoken',
  org: 'healthdash',
  bucket: 'metrics'
};

const influxDB = new InfluxDB({ url: influxConfig.url, token: influxConfig.token });
const writeApi = influxDB.getWriteApi(influxConfig.org, influxConfig.bucket);
writeApi.useDefaultTags({ app: 'HealthDashBackend' });

let cachedMetrics = [];

const amqpURL = 'amqp://guest:guest@localhost:5672';

async function startRabbitConsumer() {
  try {
    const conn = await amqp.connect(amqpURL);
    const ch = await conn.createChannel();
    await ch.assertQueue('metrics', { durable: true });

    ch.consume('metrics', (msg) => {
      if (msg !== null) {
        try {
          const metric = JSON.parse(msg.content.toString());

          const point = new Point('server_metrics')
            .tag('host', metric.host || 'unknown')
            .floatField('cpu', metric.cpu || 0)
            .floatField('mem', metric.mem || 0)
            .floatField('disk', metric.disk || 0)
            .timestamp(new Date(metric.time));

          writeApi.writePoint(point);
          writeApi.flush();

          cachedMetrics.push(metric);
          if (cachedMetrics.length > 100) {
            cachedMetrics.shift();
          }

          ch.ack(msg);
        } catch (err) {
          console.error('Failed to process message:', err);
          ch.nack(msg, false, false);
        }
      }
    });
    console.log('RabbitMQ consumer is running');
  } catch (err) {
    console.error('RabbitMQ connection error:', err);
    setTimeout(startRabbitConsumer, 5000);
  }
}

app.get('/api/health', (req, res) => {
  res.json(cachedMetrics);
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
  startRabbitConsumer();
});

