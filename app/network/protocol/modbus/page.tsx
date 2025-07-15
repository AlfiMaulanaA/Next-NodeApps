"use client"

import React, { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Network, RefreshCw, Save, CheckCircle2, XCircle } from "lucide-react"
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient"
import MqttStatus from "@/components/mqtt-status"

export default function ModbusTCPSettingsPage() {
  const [modbusIP, setModbusIP] = useState("")
  const [modbusPort, setModbusPort] = useState("")
  const [inputIP, setInputIP] = useState("")
  const [inputPort, setInputPort] = useState("")
  const [mqttStatus, setMqttStatus] = useState("Disconnected")
  const [modbusStatus, setModbusStatus] = useState("Unknown")
  const [matchConfig, setMatchConfig] = useState(false)

  useEffect(() => {
    const client = connectMQTT()
    if (!client) return

    setMqttStatus("Connecting...")

    client.on("connect", () => {
      console.log("MQTT Connected")
      setMqttStatus("Connected")
      client.subscribe("IOT/Containment/modbustcp/setting/data")
      client.subscribe("IOT/Containment/modbustcp/status")
    })

    client.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString())

        if (topic === "IOT/Containment/modbustcp/setting/data") {
          console.log("Received setting:", payload)
          const { modbus_tcp_ip, modbus_tcp_port } = payload
          setModbusIP(modbus_tcp_ip || "")
          setModbusPort(String(modbus_tcp_port || ""))
          setMatchConfig(
            inputIP === modbus_tcp_ip && String(inputPort) === String(modbus_tcp_port)
          )
        }

        if (topic === "IOT/Containment/modbustcp/status") {
          setModbusStatus(payload.modbusTCPStatus || "Unknown")
        }
      } catch (e) {
        console.error("Invalid JSON:", message.toString())
      }
    })
  }, [inputIP, inputPort])

  const getCurrentSetting = () => {
    const client = getMQTTClient()
    if (!client || !client.connected) return

    client.publish("IOT/Containment/modbustcp/setting/command", JSON.stringify({ command: "read" }))
  }

  const writeSetting = () => {
    const client = getMQTTClient()
    if (!client || !client.connected) return

    const payload = {
      command: "write",
      modbus_tcp_ip: inputIP,
      modbus_tcp_port: parseInt(inputPort, 10),
    }

    client.publish("IOT/Containment/modbustcp/setting/command", JSON.stringify(payload), {}, (err) => {
      if (!err) {
        console.log("Write command sent")
        getCurrentSetting() // Validate if updated
      }
    })
  }

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Modbus TCP Settings</h1>
        </div>
        <div className="flex items-center gap-2">
        <MqttStatus />
        <Button variant="outline" size="sm" onClick={getCurrentSetting}>
          <RefreshCw className="w-4 h-4 mr-1" /> Get Current Setting
        </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Modbus IP</label>
              <Input value={modbusIP} readOnly />
            </div>
            <div>
              <label className="text-sm font-medium">Modbus Port</label>
              <Input value={modbusPort} readOnly />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Status</label>
              <span className="text-sm">{modbusStatus}</span>
            </div>
            {matchConfig && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Configuration matched. Please restart system.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Update Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <label className="text-sm font-medium">Modbus IP</label>
              <Input value={inputIP} onChange={(e) => setInputIP(e.target.value)} placeholder="192.168.0.179" />
            </div>
            <div>
              <label className="text-sm font-medium">Modbus Port</label>
              <Input value={inputPort} onChange={(e) => setInputPort(e.target.value)} placeholder="502" />
            </div>
            <Button className="mt-4 w-full" onClick={writeSetting}>
              <Save className="w-4 h-4 mr-2" /> Save Configuration
            </Button>
            {!matchConfig && inputIP && inputPort && (
              <div className="flex items-center gap-2 text-yellow-600">
                <XCircle className="w-4 h-4" />
                <span>Config not matched yet. Please save and get config again.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  )
}
