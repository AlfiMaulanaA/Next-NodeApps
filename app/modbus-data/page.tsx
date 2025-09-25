'use client';

import { useState, useEffect } from 'react';
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Database } from "lucide-react";
import * as XLSX from 'xlsx';
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { MIBDownloader } from "@/components/MIBDownloader";

interface ModbusDataItem {
  var_name: string;
  relative_address: number;
  register_type: string;
  word_length: number;
  data_type: string;
  multiplier: number;
}

interface DeviceData {
  manufacturer: string;
  part_number: string;
  protocol: string;
  data: ModbusDataItem[];
}


export default function ModbusDataPage() {
  const [modbusData, setModbusData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDeviceData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/files/devices.json');
        if (!response.ok) {
          throw new Error('Failed to fetch devices data');
        }

        const devicesData = await response.json();

        // Find Shoto SDA10_48100 in battery section
        const batteryDevices = devicesData.battery || [];
        const targetDevice = batteryDevices.find(
          (device: DeviceData) =>
            device.manufacturer === 'Shoto' &&
            device.part_number === 'SDA10_48100'
        );

        if (!targetDevice) {
          throw new Error('Shoto SDA10_48100 device not found in devices.json');
        }

        setModbusData(targetDevice);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error loading device data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDeviceData();
  }, []);

  const getDataTypeColor = (dataType: string) => {
    switch (dataType) {
      case 'UINT16': return 'bg-blue-100 text-blue-800';
      case 'INT16': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAddressRangeColor = (address: number) => {
    if (address >= 4096 && address <= 4110) {
      return 'bg-purple-100 text-purple-800';
    } else if (address >= 8192 && address <= 8217) {
      return 'bg-orange-100 text-orange-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const exportToExcel = () => {
    if (!modbusData) return;

    const worksheet = XLSX.utils.json_to_sheet(modbusData.data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modbus Data');

    // Add device info as a separate sheet
    const deviceInfo = [
      { Property: 'Manufacturer', Value: modbusData.manufacturer },
      { Property: 'Part Number', Value: modbusData.part_number },
      { Property: 'Protocol', Value: modbusData.protocol },
      { Property: 'Total Registers', Value: modbusData.data.length }
    ];
    const deviceSheet = XLSX.utils.json_to_sheet(deviceInfo);
    XLSX.utils.book_append_sheet(workbook, deviceSheet, 'Device Info');

    XLSX.writeFile(workbook, `${modbusData.manufacturer}_${modbusData.part_number}_ModbusData.xlsx`);
  };

  const exportToCSV = () => {
    if (!modbusData) return;

    const worksheet = XLSX.utils.json_to_sheet(modbusData.data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${modbusData.manufacturer}_${modbusData.part_number}_ModbusData.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <PageSkeleton
        title="Modbus RTU Data Configuration"
        icon={Database}
        showDeviceInfo={true}
        showTable={true}
        tableRows={10}
        showCards={false}
      />
    );
  }

  if (error || !modbusData) {
    return (
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Database className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Modbus RTU Data Configuration</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-red-600">
                <p className="text-lg font-semibold mb-2">Error Loading Device Data</p>
                <p>{error || 'Device data not available'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Database className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Modbus RTU Data Configuration</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Device Information</CardTitle>
            <CardDescription>Battery Management System Configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Manufacturer</p>
                <p className="text-lg font-semibold">{modbusData.manufacturer}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Part Number</p>
                <p className="text-lg font-semibold">{modbusData.part_number}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Protocol</p>
                <p className="text-lg font-semibold">{modbusData.protocol}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MIB Downloader Section */}
        <MIBDownloader />

        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Register Mapping ({modbusData.data.length} registers)</CardTitle>
                <CardDescription>Complete list of available Modbus registers with their configurations</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={exportToExcel} variant="outline" size="sm">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Variable Name</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Address</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Register Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Data Type</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Word Length</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Multiplier</th>
                  </tr>
                </thead>
                <tbody>
                  {modbusData.data.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-4 py-2 font-medium">
                        {item.var_name}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <Badge className={getAddressRangeColor(item.relative_address)}>
                          {item.relative_address}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <Badge variant="outline">
                          {item.register_type}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <Badge className={getDataTypeColor(item.data_type)}>
                          {item.data_type}
                        </Badge>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        {item.word_length}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center font-mono">
                        {item.multiplier}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Legend</h3>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-800">4096-4110</Badge>
                  <span className="text-sm">Main Data Registers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-100 text-orange-800">8192-8217</Badge>
                  <span className="text-sm">Individual Cell Data</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">UINT16</Badge>
                  <span className="text-sm">Unsigned Integer</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">INT16</Badge>
                  <span className="text-sm">Signed Integer</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SidebarInset>
  );
}