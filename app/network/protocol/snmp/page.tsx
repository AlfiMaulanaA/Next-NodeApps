"use client"

import React, { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { RefreshCw, Save, Settings2, Wifi } from "lucide-react"
import { connectMQTT, getMQTTClient } from "@/lib/mqttClient"

const SNMP_SETTING_TOPIC_COMMAND = "IOT/Containment/snmp/setting/command"
const SNMP_SETTING_TOPIC_DATA = "IOT/Containment/snmp/setting/data"
const SNMP_STATUS_TOPIC = "IOT/Containment/snmp/status"
const SNMP_STATUS_COMMAND_TOPIC = "IOT/Containment/snmp/status/command"

export default function SNMPSettingPage() {
  const [formData, setFormData] = useState({
    snmpIPaddress: "",
    snmpNetmask: "",
    snmpGateway: "",
    snmpVersion: "3",
    authKey: "",
    privKey: "",
    securityName: "",
    securityLevel: "authPriv",
    snmpCommunity: "",
    snmpPort: "161",
    sysOID: "",
    DeviceName: "",
    Site: "",
    snmpTrapEnabled: true,
    ipSnmpManager: "",
    portSnmpManager: 162,
    snmpTrapComunity: "",
    snmpTrapVersion: "2",
    timeDelaySnmpTrap: 30,
  })

  const [status, setStatus] = useState<string>("Disconnected")

  useEffect(() => {
    const client = connectMQTT()

    client.on("connect", () => {
      setStatus("Connected")
      client.subscribe(SNMP_SETTING_TOPIC_DATA)
      client.subscribe(SNMP_STATUS_TOPIC)
    })

    client.on("message", (topic, message) => {
      const payload = JSON.parse(message.toString())
      if (topic === SNMP_SETTING_TOPIC_DATA) {
        setFormData(payload)
      } else if (topic === SNMP_STATUS_TOPIC) {
        setStatus(payload.snmpStatus || "Unknown")
      }
    })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const getConfig = () => {
    const client = getMQTTClient()
    if (!client) return alert("MQTT not connected")
    client.publish(SNMP_SETTING_TOPIC_COMMAND, JSON.stringify({ command: "read" }))
  }

  const writeConfig = () => {
    const client = getMQTTClient()
    if (!client) return alert("MQTT not connected")
    client.publish(SNMP_SETTING_TOPIC_COMMAND, JSON.stringify({
      command: "write",
      ...formData,
    }))
  }

  const checkStatus = () => {
    const client = getMQTTClient()
    if (!client) return alert("MQTT not connected")
    client.publish(SNMP_STATUS_COMMAND_TOPIC, JSON.stringify({ command: "check status" }))
  }

  return (
    <SidebarInset>
      <header className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <Wifi className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">SNMP Communication</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={getConfig}>
            <RefreshCw className="w-4 h-4 mr-1" /> Get Config
          </Button>
          <Button variant="outline" size="sm" onClick={checkStatus}>
            <Wifi className="w-4 h-4 mr-1" /> Check Status
          </Button>
        </div>
      </header>

      <div className="p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          Status: <strong>{status}</strong>
        </p>

        <Card>
          <CardContent className="grid grid-cols-2 gap-4 p-4">
            {Object.entries(formData).map(([key, value]) => {
              if (key === "snmpVersion" || key === "securityLevel" || key === "snmpTrapVersion") {
                const options = key === "snmpVersion"
                  ? ["1", "2", "3"]
                  : key === "securityLevel"
                  ? ["noAuthNoPriv", "authNoPriv", "authPriv"]
                  : ["1", "2"]
                return (
                  <div key={key} className="flex flex-col">
                    <Label htmlFor={key}>{key}</Label>
                    <Select value={String(value)} onValueChange={(val) => handleSelectChange(key, val)}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${key}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              }

              if (typeof value === "boolean") {
                return (
                  <div key={key} className="flex flex-col">
                    <Label htmlFor={key}>{key}</Label>
                    <Select value={String(value)} onValueChange={(val) => handleSelectChange(key, val)}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${key}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )
              }

              return (
                <div key={key} className="flex flex-col">
                  <Label htmlFor={key}>{key}</Label>
                  <Input
                    id={key}
                    name={key}
                    type={typeof value === "number" ? "number" : "text"}
                    value={value}
                    onChange={handleChange}
                  />
                </div>
              )
            })}

            <div className="col-span-2">
              <Button className="w-full" onClick={writeConfig}>
                <Save className="w-4 h-4 mr-2" /> Save Config
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  )
}
