"use client"

import React, { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Network, RefreshCw, Save, Settings2 } from "lucide-react"
import axios from "axios"
import { connectMQTT } from "@/lib/mqttClient"

export default function ModbusTCPPage() {
  const [modbusIP, setModbusIP] = useState("")
  const [modbusPort, setModbusPort] = useState<number | "">("")
  const [modbusStatus, setModbusStatus] = useState("")
  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    const mqttClient = connectMQTT()
    setClient(mqttClient)

    mqttClient.subscribe("IOT/Containment/modbustcp/setting/data")
    mqttClient.subscribe("IOT/Containment/modbustcp/status")

    const handleMessage = (topic: string, message: Buffer) => {
      const payload = JSON.parse(message.toString())
      if (topic === "IOT/Containment/modbustcp/setting/data") {
        setModbusIP(payload.modbus_tcp_ip)
        setModbusPort(payload.modbus_tcp_port)
      } else if (topic === "IOT/Containment/modbustcp/status") {
        setModbusStatus(payload.modbusTCPStatus || "Unknown status")
      }
    }

    mqttClient.on("message", handleMessage)

    return () => {
      mqttClient.unsubscribe("IOT/Containment/modbustcp/setting/data")
      mqttClient.unsubscribe("IOT/Containment/modbustcp/status")
      mqttClient.end()
    }
  }, [])

  const requestModbusSettings = () => {
    if (!client) return
    client.publish(
      "IOT/Containment/modbustcp/setting/command",
      JSON.stringify({ command: "read" })
    )
  }

  const checkModbusStatus = () => {
    if (!client) return
    client.publish(
      "IOT/Containment/modbustcp/status/command",
      JSON.stringify({ command: "check status" })
    )
  }

  const updateModbusSettings = () => {
    if (!client) return
    client.publish(
      "IOT/Containment/modbustcp/setting/command",
      JSON.stringify({
        command: "write",
        modbus_tcp_ip: modbusIP,
        modbus_tcp_port: modbusPort,
      })
    )

    setTimeout(() => {
      requestModbusSettings()
    }, 2000)

    restartService()
  }

  const restartService = async () => {
    try {
      await axios.post("/api/restart-protocol")
      alert("Service restarted successfully.")
    } catch (error: any) {
      alert("Failed to restart service: " + error.message)
    }
  }

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Network className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Modbus TCP Communication</h1>
        </div>
        <Button variant="outline" size="sm" onClick={checkModbusStatus}>
          <RefreshCw className="w-4 h-4 mr-1" /> Check Status
        </Button>
      </header>

      <div className="p-6 space-y-8">
        <section className="bg-background shadow-md p-6 rounded-2xl border space-y-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Modbus TCP Status
          </h2>
          <p className={modbusStatus ? "text-green-600 bg-green-100 p-2 rounded font-bold" : "text-red-500 bg-red-100 p-2 rounded font-bold"}>
            {modbusStatus || "No status available"}
          </p>
        </section>

        <section className="bg-background shadow-md p-6 rounded-2xl border space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5" /> Modbus TCP Settings
            </h2>
            <Button size="sm" variant="secondary" onClick={requestModbusSettings}>
              <RefreshCw className="w-4 h-4 mr-1" /> Request
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">IP Address</label>
              <Input
                value={modbusIP}
                onChange={(e) => setModbusIP(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Port</label>
              <Input
                type="number"
                value={modbusPort}
                onChange={(e) => setModbusPort(Number(e.target.value))}
                placeholder="502"
              />
            </div>
          </div>
          <Button className="mt-4" onClick={updateModbusSettings}>
            <Save className="w-4 h-4 mr-2" /> Save Settings
          </Button>
        </section>
      </div>
    </SidebarInset>
  )
}
