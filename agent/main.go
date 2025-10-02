package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/streadway/amqp"
)

type Metrics struct {
	CPU      float64 `json:"cpu"`
	Memory   float64 `json:"mem"`
	Disk     float64 `json:"disk"`
	Hostname string  `json:"host"`
	Time     string  `json:"time"`
}

func collectMetrics() string {
	hostname, _ := os.Hostname()
	cpuPercents, _ := cpu.Percent(time.Second, false)
	cpuUsage := 0.0
	if len(cpuPercents) > 0 {
		cpuUsage = cpuPercents[0]
	}
	memStats, _ := mem.VirtualMemory()
	diskStats, _ := disk.Usage("/")
	metrics := Metrics{
		CPU:      cpuUsage,
		Memory:   memStats.UsedPercent,
		Disk:     diskStats.UsedPercent,
		Hostname: hostname,
		Time:     time.Now().Format(time.RFC3339),
	}
	buf, _ := json.Marshal(metrics)
	return string(buf)
}

func failOnError(err error, msg string) {
	if err != nil {
		log.Fatalf("%s: %s", msg, err)
	}
}

func main() {
	amqpURL := "amqp://guest:guest@rabbitmq:5672/"
	if url := os.Getenv("AMQP_URL"); url != "" {
		amqpURL = url
	}

	conn, err := amqp.Dial(amqpURL)
	failOnError(err, "Failed to connect to RabbitMQ")
	defer conn.Close()

	ch, err := conn.Channel()
	failOnError(err, "Failed to open a channel")
	defer ch.Close()

	q, err := ch.QueueDeclare(
		"metrics", true, false, false, false, nil,
	)
	failOnError(err, "Failed to declare a queue")

	for {
		body := collectMetrics()
		err = ch.Publish(
			"", q.Name, false, false,
			amqp.Publishing{
				ContentType: "application/json",
				Body:        []byte(body),
			},
		)
		if err != nil {
			log.Printf("Failed to send metrics: %s", err)
		} else {
			fmt.Println("Sent:", body)
		}
		time.Sleep(10 * time.Second)
	}
}
